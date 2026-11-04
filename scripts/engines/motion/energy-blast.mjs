// An energy blast: a flash, a shockwave bending the floor, the energy itself, what it leaves behind. Each kind of energy its
// own. Three passes of one shader: the floor, bent and marked, under the tiles and the creatures; what hides them (smoke,
// ice, a cloud) over them; the light, over the darkness. Once the floor has settled its mark is kept as a picture, so
// only the few seconds of the blast itself cost anything. Drawn on each screen and never saved.

const DIR = 'modules/animater/assets/sounds';
const fs = (name) => `${DIR}/surfaces/freesound/${name}.ogg`;

export const BLAST_TYPES = Object.freeze([
  { id: 'fire', name: 'Fire', shader: 0, a: [1.0, 0.42, 0.08], b: [1.0, 0.86, 0.5], icon: 'fa-fire' },
  { id: 'cold', name: 'Cold', shader: 1, a: [0.42, 0.74, 1.0], b: [0.9, 0.97, 1.0], icon: 'fa-snowflake' },
  { id: 'electricity', name: 'Lightning', shader: 2, a: [0.5, 0.68, 1.0], b: [0.95, 0.97, 1.0], icon: 'fa-bolt' },
  { id: 'acid', name: 'Acid', shader: 3, a: [0.5, 0.86, 0.14], b: [0.86, 1.0, 0.4], icon: 'fa-flask' },
  { id: 'force', name: 'Force', shader: 4, a: [0.72, 0.68, 1.0], b: [0.92, 0.9, 1.0], icon: 'fa-circle-dot' },
  { id: 'void', name: 'Void', shader: 5, a: [0.5, 0.16, 0.8], b: [0.72, 0.42, 1.0], icon: 'fa-skull' },
  { id: 'radiant', name: 'Radiant', shader: 6, a: [1.0, 0.8, 0.36], b: [1.0, 0.97, 0.82], icon: 'fa-sun' },
  { id: 'sonic', name: 'Sonic', shader: 7, a: [0.8, 0.84, 0.9], b: [0.95, 0.96, 1.0], icon: 'fa-volume-high' },
  { id: 'poison', name: 'Poison', shader: 8, a: [0.56, 0.72, 0.16], b: [0.82, 0.9, 0.34], icon: 'fa-skull-crossbones' },
  { id: 'psychic', name: 'Psychic', shader: 9, a: [0.9, 0.24, 0.72], b: [0.45, 0.85, 1.0], icon: 'fa-brain' },
]);
export const blastType = (id) => BLAST_TYPES.find((t) => t.id === id) ?? BLAST_TYPES[0];
// How far it reaches: a normal blast and a big one (Shift), by the map's squares. The front runs a little past this.
export const blastRadius = (big, grid = 100) => grid * (big ? 4 : 2);
// Sizing a blast or a cave-in as it is aimed (pure), in squares from its middle: the wheel in half squares, Shift doubling it
// while held, never past the most a map can sensibly take.
export const AIM_LEAST = 0.5, AIM_MOST = 10;
export const stepSquares = (squares, way) => Math.min(AIM_MOST, Math.max(AIM_LEAST, Math.round(((Number(squares) || 2) + (way > 0 ? 0.5 : -0.5)) * 2) / 2));
export const aimSquares = (squares, doubled = false) => Math.min(AIM_MOST, (Number(squares) || 2) * (doubled ? 2 : 1));
// The ring that bends everything on the map, creatures too (scene-distortion.mjs, a blast's own 'shock'), a little past the
// blast's reach; how hard by the kind. Null for a kind with no front to it.
const RIPPLE = { force: 1.3, sonic: 1.3, fire: 1, electricity: 0.7, cold: 0.8, radiant: 0.7, void: 1, acid: 0.55, poison: 0, psychic: 0.8 };
export function blastRipple({ x, y, radius, kind, grid = 100, level = null } = {}) {
  const strength = RIPPLE[kind] ?? 1;
  if (!(strength > 0)) return null;
  const reach = radius * 1.35;
  return { kind: 'shock', at: { x, y }, radius: reach, band: Math.max(grid * 0.45, radius * 0.22), startMs: 0, lengthMs: Math.round(Math.min(2200, 900 + (reach / grid) * 200)), strength, follow: false, ...(typeof level === 'string' && level ? { level } : {}) };
}
// How the view shakes: waves of { at (ms), weight, scale }, by how hard the kind hits and how big it is. Psychic moves nothing.
export function blastShake(id, big = false) {
  const hard = { force: 1.25, sonic: 1.2, fire: 1, electricity: 0.8, cold: 0.8, radiant: 0.7, void: 0.9, acid: 0.55, poison: 0.3, psychic: 0 }[id] ?? 1;
  if (!(hard > 0)) return [];
  const k = big ? 2 : 1.3;
  return [{ at: 0, weight: big ? 12 : 9, scale: Math.min(2, k * hard) }, { at: 280, weight: big ? 10 : 7, scale: Math.min(2, k * hard * 0.7) }, ...(big ? [{ at: 700, weight: 9, scale: Math.min(2, hard) }] : [])];
}
// What it sounds like: the kind's own recordings over a deep thud (rate lower for a big one). Each { kind, file?, rate, volume, wait }.
const OWN = {
  fire: [fs('fire-burst-260554-0'), fs('fire-burst-260555-0'), fs('fire-burst-637533-0')],
  cold: [fs('frost-crack-114253-0'), fs('frost-crack-213579-0'), fs('frost-crack-264420-0')],
  electricity: [fs('electric-arc-189630-0'), fs('electric-arc-403253-0'), fs('electric-arc-536793-0')],
  acid: [fs('acid-fizz-713705-0'), fs('acid-fizz-771957-0')],
  poison: [fs('steam-hiss-438640-0'), fs('steam-hiss-438640-1')],
  force: [], void: [], radiant: [], sonic: [], psychic: [],
};
export const blastFiles = (id) => OWN[id] ?? [];
export function blastSounds(id, { big = false, random = Math.random } = {}) {
  const own = OWN[id] ?? [], lower = big ? 0.8 : 1, out = [];
  if (own.length) out.push({ file: own[Math.floor(random() * own.length) % own.length], rate: lower * (0.9 + random() * 0.2), volume: 1, wait: 0 });
  // Kinds with no recording of their own yet: moving air, pitched to suit.
  // A whole recording is many seconds, far longer than a blast (more when slowed), so it is cut: `holds` ms, then `fades` ms.
  else if (id !== 'psychic') out.push({ wind: true, rate: { force: 0.6, void: 0.45, radiant: 1.25, sonic: 0.85 }[id] ?? 1, volume: 0.9, wait: 0, holds: big ? 1500 : 900, fades: 900 });
  else out.push({ wind: true, rate: 0.5, volume: 0.55, wait: 0, holds: big ? 1100 : 700, fades: 800 });
  if (id !== 'psychic' && id !== 'poison') out.push({ thud: true, rate: lower * ({ force: 0.42, sonic: 0.5, void: 0.34 }[id] ?? 0.46), volume: 1, wait: 40 });
  if (big && id !== 'psychic' && id !== 'poison') out.push({ thud: true, rate: 0.33, volume: 0.85, wait: 320 });
  return out;
}

const VERT = `attribute vec2 aVertexPosition;
uniform mat3 projectionMatrix, translationMatrix; uniform vec2 uCenter; uniform float uR; varying vec2 vQ;
void main(){ vQ = (aVertexPosition - uCenter) / uR; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
const FRAG = `precision highp float;
varying vec2 vQ;
uniform float uT, uSeed, uR, uGridR; uniform int uType, uPass; uniform sampler2D uFloor; uniform vec3 uA, uB; uniform vec2 uCenter; uniform vec4 uRect;
float h(vec2 p){ return fract(sin(dot(p + uSeed, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 17.3; a *= 0.5; } return s; }
float ridge(vec2 p){ return 1.0 - abs(fbm(p) * 2.0 - 1.0); }
float ss(float a, float b, float x){ return smoothstep(a, b, x); }
void main(){
  vec2 q = vQ;
  float spark = min(1.0, pow(uGridR, 2.0));   // a spark's size against a two-square blast's
  float t = uT, r = length(q), a = atan(q.y, q.x);
  vec2 dir = q / max(r, 1e-3);
  float s = 1.2 * (1.0 - exp(-t * 3.6));                       // the shock front
  float fade = 1.0 - ss(0.5, 1.25, t);
  float band = exp(-pow((r - s) / 0.075, 2.0)) * fade * (0.45 + 0.8 * n(vec2(a * 5.0, t * 2.0)));   // the bent air at the front, uneven
  float refr = 0.012;
  if (uType == 4) refr = 0.11; if (uType == 7) refr = 0.075; if (uType == 9) refr = 0.09;
  vec2 bend = dir * band * refr;
  float extra = 0.0;
  if (uType == 4) { float s2 = s * 0.66, s3 = s * 0.38; extra = exp(-pow((r - s2) / 0.05, 2.0)) * fade * 0.7 + exp(-pow((r - s3) / 0.035, 2.0)) * fade * 0.45; bend += dir * extra * 0.09; }
  if (uType == 7) { float wave = sin(r * 58.0 - t * 34.0) * ss(s + 0.02, s - 0.1, r) * exp(-t * 1.8); extra = wave; bend += dir * wave * 0.02; }
  vec2 warp = vec2(0.0);
  if (uType == 9) { float life = ss(0.0, 0.2, t) * (1.0 - ss(1.4, 2.8, t)); float rot = sin(r * 13.0 - t * 5.0) * 0.22 * life * ss(1.3, 0.1, r); warp = vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot)) - q; }
  vec2 uv = q + bend + warp;
  vec2 tuv = (uCenter + uv * uR - uRect.xy) / uRect.zw;
  vec3 col;
  if (uType == 9) { float split = 0.012 * ss(0.0, 0.2, t) * (1.0 - ss(1.2, 2.6, t)) * ss(1.4, 0.2, r); col = vec3(texture2D(uFloor, tuv + dir * split).r, texture2D(uFloor, tuv).g, texture2D(uFloor, tuv - dir * split).b); }
  else col = texture2D(uFloor, tuv).rgb;
  // What it leaves on the floor, torn at its edge, fading in as the blast passes and away at the end.
  float tear = fbm(q * 4.0 + 3.0) + (n(q * 20.0) - 0.5) * 0.16, reach = 0.72 + (tear - 0.5) * 0.75, mark = ss(reach, reach - 0.42, r) * ss(0.05, 0.4, t) * (0.55 + 0.6 * fbm(q * 9.0));
  vec3 glow = vec3(0.0); float cover = 0.0; vec3 coverCol = vec3(0.0);
  if (uType == 0) {           // fire
    col *= 1.0 - min(1.0, mark) * 0.86;
    float cr = pow(ridge(q * 6.0), 14.0) * mark; glow += vec3(1.0, 0.26, 0.04) * cr * (1.0 - ss(0.7, 3.0, t)) * 0.9;
    float b = 0.2 + s * 0.84, edge = (fbm(vec2(a * 2.6, r * 3.2 - t * 2.8)) - 0.5) * 1.0, d = r / b + edge * 0.55, heat = (1.0 - ss(0.2, 0.95, t));
    float flame = ss(1.1, 0.35, d) * heat * ss(0.22, 0.62, fbm(q * 4.5 - dir * t * 3.0) + (heat - 0.5) * 0.42);
    glow += mix(vec3(0.75, 0.1, 0.01), mix(vec3(1.0, 0.45, 0.06), vec3(1.0, 0.92, 0.6), ss(0.45, 1.0, flame)), ss(0.1, 0.5, flame)) * flame * 2.2;
    float smoke = ss(0.25, 0.9, t) * (1.0 - ss(1.8, 3.8, t)) * ss(1.25, 0.2, r + (fbm(q * 2.4 + t * 0.25) - 0.5) * 0.6); cover = smoke * 0.5 * ss(0.25, 0.7, fbm(q * 3.4 + vec2(t * 0.2, -t * 0.3))); coverCol = vec3(0.1, 0.09, 0.085);
    for (int i = 0; i < 24; i++) { float fi = float(i), ang = h(vec2(fi, 2.1)) * 6.283, sp = 0.5 + h(vec2(fi, 4.4)) * 1.2; vec2 at = vec2(cos(ang), sin(ang)) * sp * (1.0 - exp(-t * 2.2)) + vec2(0.0, 0.1) * t; float lf = 1.0 - ss(0.5, 1.2 + h(vec2(fi, 7.0)), t); glow += vec3(1.0, 0.5, 0.12) * exp(-dot(q - at, q - at) / (0.00022 * spark)) * lf * 2.2; }
  } else if (uType == 1) {    // cold
    float frost = mark * (0.45 + 0.55 * fbm(q * 9.0)); col = mix(col, col * 0.75 + vec3(0.32, 0.4, 0.46), min(1.0, frost) * 0.7);
    float fine = pow(ridge(q * 11.0), 6.0) * mark; col += vec3(0.7, 0.85, 1.0) * fine * 0.28;
    float spike = 0.2 + 0.62 * pow(abs(sin(a * 17.0 + fbm(vec2(a * 5.0, 2.0)) * 11.0)), 7.0) * (0.25 + 0.9 * pow(n(vec2(a * 13.0, 4.0)), 2.0));
    float grow = 1.0 - exp(-t * 7.0), shatter = 1.0 - ss(0.75, 1.5, t), inSpike = ss(0.02, -0.02, r - spike * grow) * shatter;
    float facet = fbm(vec2(a * 24.0, r * 8.0)); coverCol = mix(vec3(0.46, 0.62, 0.74), vec3(0.86, 0.94, 0.98), facet); cover = inSpike * (0.28 + 0.34 * facet);
    glow += uA * exp(-r * 3.4) * exp(-t * 4.0) * 0.5;
    float mist = fbm(q * 2.6 + vec2(t * 0.14, -t * 0.09)) * ss(1.3, 0.3, r) * ss(0.1, 0.6, t) * (1.0 - ss(1.8, 3.8, t)); col = mix(col, vec3(0.72, 0.8, 0.86), mist * 0.32);
  } else if (uType == 2) {    // lightning
    float burnt = 0.0, arcs = 0.0, flick = step(0.35, n(vec2(t * 26.0, 1.0)));
    for (int i = 0; i < 8; i++) { float fi = float(i), base = fi / 8.0 * 6.283 + h(vec2(fi, 9.0)) * 0.7, seedT = floor(t * 15.0), jag = (n(vec2(r * 7.0 + fi * 9.0, seedT + fi)) - 0.5) * 0.7 + (n(vec2(r * 26.0 + fi, seedT)) - 0.5) * 0.2, dA = mod(a - base - jag * r + 3.1416, 6.2832) - 3.1416, dist = abs(dA) * r, len = (0.75 + h(vec2(fi, 3.0)) * 0.55) * ss(0.0, 0.08, t); float inLen = ss(len, len - 0.1, r); arcs += exp(-dist * dist / 0.00012) * inLen; float jag2 = (n(vec2(r * 7.0 + fi * 9.0, fi)) - 0.5) * 0.7, d2 = abs(mod(a - base - jag2 * r + 3.1416, 6.2832) - 3.1416) * r; burnt += exp(-d2 * d2 / 0.00045) * ss(len, len - 0.2, r); }
    col *= 1.0 - min(1.0, burnt) * 0.72 * mark; col *= 1.0 - mark * 0.3;
    float life = 1.0 - ss(0.45, 1.05, t); glow += mix(uA, uB, 0.75) * arcs * life * (0.45 + 0.55 * flick) * 3.2 + uA * exp(-r * 2.2) * life * flick * 1.0;
  } else if (uType == 3) {    // acid
    float v = fbm(q * 6.0 + 11.0), reachA = s * 1.0 * (0.72 + v * 0.45), spat = ss(0.48, 0.52, v + (n(q * 34.0) - 0.5) * 0.09 + (0.25 - r * 0.34)) * ss(reachA + 0.04, reachA - 0.1, r);
    float burn = spat * (1.0 - ss(3.8, 5.2, t)); col = mix(col, col * vec3(0.22, 0.27, 0.1), burn * 0.92);
    float wet = (1.0 - ss(0.4, 2.8, t)) * burn, rim = ss(0.0, 0.05, v + (0.28 - r * 0.32) - 0.46) * (1.0 - ss(0.05, 0.14, v + (0.28 - r * 0.32) - 0.46)) * burn; glow += uA * rim * (1.0 - ss(0.8, 3.6, t)) * 0.22; glow += uA * wet * 0.14 * (0.3 + 0.7 * n(q * 16.0 + t * 2.5));
    float bub = 0.0; for (int i = 0; i < 14; i++) { float fi = float(i), rr = h(vec2(fi, 1.0)) * 0.72, an = h(vec2(fi, 2.0)) * 6.283, ph = fract(t * (0.5 + h(vec2(fi, 3.0))) + h(vec2(fi, 5.0))), sz = 0.01 + ph * 0.028; vec2 c = vec2(cos(an), sin(an)) * rr; float dd = length(q - c); bub += ss(0.004, 0.0, abs(dd - sz)) * (1.0 - ph); } glow += uA * bub * burn * (1.0 - ss(1.2, 3.6, t)) * 0.3;
    float fum = fbm(q * 3.0 + vec2(0.0, t * 0.35)) * ss(1.1, 0.2, r) * ss(0.2, 0.8, t) * (1.0 - ss(1.8, 3.6, t)); col = mix(col, vec3(0.36, 0.44, 0.16), fum * 0.2);
  } else if (uType == 4) {    // force
    float crack = pow(ridge(q * 5.0 + 5.0), 18.0) * mark; col *= 1.0 - crack * 0.85; col *= 1.0 - mark * 0.12;
    glow += uA * (band * 0.08 + extra * 0.05) + uB * exp(-r * r * 18.0) * exp(-t * 11.0) * 2.0;
  } else if (uType == 5) {    // void
    col *= 1.0 - mark * 0.72;
    float pull = ss(0.0, 0.1, t) * (1.0 - ss(0.2, 0.3, t)), out_ = ss(0.2, 0.32, t), life = 1.0 - ss(1.0, 2.2, t);
    float tend = pow(ridge(vec2(a * 3.0 + r * 1.6 - t * 0.7, r * 2.2 - t * 1.7)), 3.2);
    float body = ss(0.14 + s * 0.85 * out_, 0.02, r - (tend - 0.5) * 0.5 * s) * out_ * life, hole = ss(0.32, 0.05, r) * max(pull, life * out_);
    cover = max(body * (0.5 + 0.5 * tend), hole * 0.98); coverCol = vec3(0.012, 0.0, 0.02);
    glow += uA * (ss(0.2, 0.0, abs(body - 0.42)) * body * 0.0 + exp(-pow((r - (0.14 + s * 0.85 * out_)) / 0.14, 2.0)) * tend * tend * life * 0.28) + uB * band * 0.05;
    glow += uB * ss(0.0, 0.18, r) * ss(0.42, 0.12, r) * life * out_ * 0.14 * (0.3 + 0.7 * n(vec2(a * 6.0, t * 3.0)));
    float streak = pow(n(vec2(a * 22.0, r * 2.0 + t * 7.0)), 7.0) * pull * ss(1.3, 0.1, r); glow += uB * streak * 2.0;
  } else if (uType == 6) {    // radiant
    float gild = mark * (0.5 + 0.5 * fbm(q * 7.0)) * (1.0 - ss(1.2, 5.0, t)); col = mix(col, col * vec3(1.5, 1.28, 0.8) + vec3(0.1, 0.075, 0.02), gild);
    float rays = pow(n(vec2(a * 9.0 + 1.0, 0.7 + t * 0.14)), 3.0) + 0.6 * pow(n(vec2(a * 23.0, 3.0 - t * 0.09)), 5.0);
    float life = ss(0.0, 0.08, t) * (1.0 - ss(0.8, 2.3, t)); glow += uA * rays * exp(-r * 2.6) * life * 1.15;
    glow += mix(uA, uB, 0.7) * exp(-r * r * 10.0) * life * 0.8 + uB * exp(-r * r * 1.3) * exp(-t * 4.0) * 1.1 + uA * band * 0.1;
    for (int i = 0; i < 26; i++) { float fi = float(i), an = h(vec2(fi, 3.3)) * 6.283, sp = 0.2 + h(vec2(fi, 8.2)) * 1.0; vec2 at = vec2(cos(an), sin(an)) * sp * (1.0 - exp(-t * 1.4)); float tw = 0.5 + 0.5 * sin(t * 13.0 + fi * 2.0); glow += uB * exp(-dot(q - at, q - at) / (0.00012 * spark)) * tw * life * 2.0; }
  } else if (uType == 7) {    // sonic
    float dust = fbm(q * 7.0 + dir * t * 2.0) * ss(s + 0.1, s - 0.2, r) * ss(0.05, 0.25, r) * exp(-t * 1.5); col = mix(col, vec3(0.62, 0.58, 0.52), dust * 0.42);
    col *= 1.0 - mark * pow(ridge(q * 8.0), 11.0) * 0.72; glow += uB * (max(extra, 0.0) * 0.035 + band * 0.07);
  } else if (uType == 8) {    // poison
    float grow = 1.0 - exp(-t * 1.1), edge = fbm(q * 2.2 + vec2(t * 0.1, 3.0) + fbm(q * 3.0 - t * 0.12)), cloud = ss(grow * 1.25, grow * 0.3, r + (edge - 0.5) * 0.8) * (1.0 - ss(3.2, 5.0, t)) * (0.45 + 0.75 * fbm(q * 3.4 + vec2(-t * 0.14, t * 0.1)));
    cover = min(0.62, cloud * 0.72); coverCol = mix(vec3(0.17, 0.21, 0.06), vec3(0.42, 0.5, 0.14), fbm(q * 5.0 + t * 0.2)); col *= 1.0 - mark * 0.15;
  } else {                    // psychic
    float life = ss(0.0, 0.2, t) * (1.0 - ss(1.2, 2.8, t)), rip = pow(0.5 + 0.5 * sin(r * 17.0 - t * 7.0 + (fbm(q * 2.4 + t * 0.3) - 0.5) * 11.0), 12.0) * ss(1.3, 0.1, r) * (0.3 + 0.9 * fbm(q * 5.0 - t * 0.4));
    glow += mix(uA, uB, 0.5 + 0.5 * sin(a * 2.0 + r * 5.0 - t * 2.0)) * rip * life * 0.3 + uA * exp(-r * r * 6.0) * life * 0.12 + uB * band * 0.05;
    col = mix(col, vec3(dot(col, vec3(0.33))), life * ss(1.2, 0.3, r) * 0.65);
  }
  // The first instant's flash; the front catching the light; dust thrown up by it.
  glow += uB * exp(-r * r * 2.2) * exp(-t * 11.0) * (uType == 4 || uType == 7 ? 0.9 : 2.8);
  if (uType != 4 && uType != 7) glow += uA * band * 0.07;
  float dusty = fbm(q * 5.0 + dir * t * 1.6) * exp(-pow((r - s * 0.86) / 0.17, 2.0)) * (1.0 - ss(0.35, 1.4, t)); col = mix(col, vec3(0.44, 0.4, 0.36), dusty * 0.5 * (uType == 4 ? 0.65 : 1.0));
  float edge = ss(1.62, 1.3, r);
  // Only what it changed, faded by how much: the map itself stays the real map, crisp, wherever nothing happened to it.
  if (uPass == 0) { vec3 was = texture2D(uFloor, (uCenter + q * uR - uRect.xy) / uRect.zw).rgb; gl_FragColor = vec4(col, 1.0) * edge * clamp(length(col - was) * 9.0, 0.0, 1.0); return; }
  if (uPass == 1) { float c = clamp(cover, 0.0, 1.0) * edge; gl_FragColor = vec4(coverCol * c, c); return; }
  vec3 lit = glow * edge; lit = lit / (1.0 + max(0.0, max(lit.r, max(lit.g, lit.b)) - 1.0) * 0.55);
  gl_FragColor = vec4(lit, 0.0);
}`;

// When the floor's mark is kept as a picture, how long the whole blast runs, the largest the kept picture may be (else a
// pixel of it to a pixel of the map, so it is as sharp as the map).
const SETTLED = 3.6, ENDS = 5.6, KEPT_MOST = 2048;

/** The layer: play({ x, y, radius, kind, seed }); tick(seconds); clear(). `floor()`, `above()` and `glow()` its layers; `map()` the map's picture and where it lies ({ texture, rect }; none: no bent floor, no mark); `render(mesh, options)` draws into a picture; `markSeconds()` how long a mark lasts. */
export function createEnergyBlasts({ PIXI, floor, above, glow, map, render, markSeconds = () => 120 }) {
  let live = [], marks = [];
  const meshOf = (geometry, uniforms, pass, parent, add = false) => { const m = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, { ...uniforms, uPass: pass })); m.eventMode = 'none'; if (add) m.blendMode = PIXI.BLEND_MODES.ADD; parent.addChild(m); return m; };
  const dropMark = (m) => { try { m.s.destroy(); m.tex.destroy(true); } catch { /* gone */ } };
  const keep = (b) => {
    // The floor as it has settled, into a picture that stays and fades (the mesh's cost gone).
    const span = b.radius * 3.3, x0 = b.x - span / 2, y0 = b.y - span / 2, size = Math.min(KEPT_MOST, Math.ceil(span)), k = size / span, tex = PIXI.RenderTexture.create({ width: size, height: size });
    b.floor.shader.uniforms.uT = SETTLED; const parent = b.floor.parent; parent.removeChild(b.floor);
    try { render(b.floor, { renderTexture: tex, clear: true, transform: new PIXI.Matrix(k, 0, 0, k, -x0 * k, -y0 * k) }); } catch { /* no mark, then */ }
    b.floor.destroy(); b.floor = null;
    const s = new PIXI.Sprite(tex); s.eventMode = 'none'; s.position.set(x0, y0); s.width = s.height = span; parent.addChild(s);
    marks.push({ s, tex, age: 0 }); while (marks.length > 12) dropMark(marks.shift());
  };
  const end = (b) => { for (const m of [b.floor, b.cover, b.light]) { try { m?.destroy(); } catch { /* gone */ } } try { b.geometry.destroy(); } catch { /* gone */ } };
  let warmed = false;
  return {
    // The graphics driver takes up to a second to prepare this shader the first time it draws, all at once: drawn here
    // once out of sight (as a scene loads, when a moment more goes unnoticed), so the first blast is as quick as the rest.
    warm() {
      if (warmed) return; warmed = true;
      let geometry = null, mesh = null, tex = null;
      try {
        const type = blastType('fire');
        geometry = new PIXI.Geometry().addAttribute('aVertexPosition', [0, 0, 4, 0, 4, 4, 0, 4], 2).addIndex([0, 1, 2, 0, 2, 3]);
        mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, { uT: 0.5, uSeed: 1, uR: 2, uGridR: 1, uCenter: [2, 2], uType: type.shader, uA: type.a, uB: type.b, uFloor: PIXI.Texture.WHITE, uRect: [0, 0, 4, 4], uPass: 1 }));
        tex = PIXI.RenderTexture.create({ width: 4, height: 4 });
        render(mesh, { renderTexture: tex, clear: true });
      } catch { /* the first blast prepares it, then */ }
      try { mesh?.destroy(); geometry?.destroy(); tex?.destroy(true); } catch { /* gone */ }
    },
    play({ x, y, radius, kind = 'fire', grid = 100, seed = Math.random() * 100 } = {}) {
      const type = blastType(kind), half = radius * 1.65, ground = map();
      const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', [x - half, y - half, x + half, y - half, x + half, y + half, x - half, y + half], 2).addIndex([0, 1, 2, 0, 2, 3]);
      const uniforms = { uT: 0, uSeed: seed % 97, uR: radius, uGridR: (grid * 2) / radius, uCenter: [x, y], uType: type.shader, uA: type.a, uB: type.b, uFloor: ground?.texture ?? PIXI.Texture.WHITE, uRect: ground ? [ground.rect.x, ground.rect.y, ground.rect.width, ground.rect.height] : [0, 0, 1, 1] };
      const b = { x, y, radius, t: 0, geometry, floor: ground ? meshOf(geometry, uniforms, 0, floor()) : null, cover: meshOf(geometry, uniforms, 1, above()), light: meshOf(geometry, uniforms, 2, glow(), true) };
      live.push(b);
      return b;
    },
    tick(seconds) {
      if (live.length) live = live.filter((b) => {
        b.t += seconds;
        for (const m of [b.floor, b.cover, b.light]) if (m) m.shader.uniforms.uT = b.t;
        if (b.floor && b.t >= SETTLED) keep(b);
        if (b.t >= ENDS) { end(b); return false; }
        return true;
      });
      if (marks.length) { const last = Math.max(10, Number(markSeconds()) || 120), fade = last * 0.3; marks = marks.filter((m) => { m.age += seconds; if (m.age >= last) { dropMark(m); return false; } if (m.age > last - fade) m.s.alpha = (last - m.age) / fade; return true; }); }
    },
    clear() { for (const b of live) end(b); live = []; for (const m of marks) dropMark(m); marks = []; },
    get busy() { return live.length + marks.length > 0; },
    get playing() { return live.length; },
    get marks() { return marks.length; },
  };
}
