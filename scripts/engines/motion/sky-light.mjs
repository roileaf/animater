// The sky over the map: cloud shadows drifting with the wind, the sun glittering on water and rippling over its banks,
// snow and ice sparkling, the air shimmering over hot ground at midday, and lightning flashing in a storm. What the
// weather is and where each surface lies is pure; the light is drawn by one shader over the map (createSurfaceLight),
// the shimmer by one filter on it (createHeatShimmer) and the flash by one sprite over it (createLightningFlash).

// A scene's own wind (Scene configuration → Animater wind): how strong, against the weather's ('sheltered' halves it),
// and where it blows from (compass points, as a weather report gives them: a north wind comes from the north).
export const SCENE_WINDS = Object.freeze({ calm: 0, breeze: 0.3, windy: 0.6, gale: 1 });
export const WIND_FROM = Object.freeze({ n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 });
// Where a wind from `bearing` degrees (clockwise from north, up the map) blows toward, as an angle on the map (radians).
const blowingFrom = (bearing) => ((bearing + 180 - 90) * Math.PI) / 180;

// Calendaria's weather (its getCurrentWeather) and the scene's own: how windy (0 still – 1 a gale), which way the wind
// blows (radians, the way it goes), how hot (°C, null when unknown), whether a storm throws lightning and how fierce it
// is (`severity`, 0 none – 1 the worst: stormSeverity). `own`: the scene's own wind ({ wind, windFrom }: a SCENE_WINDS
// key or 'sheltered', a WIND_FROM key), over the weather's. `fx`: FXMaster's effects on the scene, `fxFilters` its filters.
export function weatherOf({ calendaria = null, scene = '', fx = {}, fxFilters = {}, own = null } = {}) {
  const speed = Number(calendaria?.wind?.speed);
  // Calendaria gives its wind as a force from 0 to 5, or a speed in km/h.
  let wind = Number.isFinite(speed) ? Math.min(1, speed <= 5 ? speed / 5 : speed / 60) : /storm|blizzard/i.test(scene) ? 0.8 : /rain|snow/i.test(scene) ? 0.4 : 0.2;
  if (own?.wind in SCENE_WINDS) wind = SCENE_WINDS[own.wind];
  else if (own?.wind === 'sheltered') wind /= 2;
  const toward = Number(calendaria?.wind?.direction);
  // Calendaria's direction is where the wind comes from, in degrees clockwise from north: it blows the other way. With
  // none, a north-west wind.
  const windAngle = blowingFrom(own?.windFrom in WIND_FROM ? WIND_FROM[own.windFrom] : Number.isFinite(toward) ? toward : WIND_FROM.nw);
  const temperature = Number.isFinite(Number(calendaria?.temperature)) && calendaria?.temperature !== null ? Number(calendaria.temperature) : null;
  const named = `${calendaria?.id ?? ''} ${calendaria?.label ?? ''} ${scene ?? ''}`;
  const fxLightning = Object.values(fxFilters ?? {}).find((f) => /lightning/i.test(String(f?.type ?? '')));
  const storm = /thunder|lightning|storm/i.test(named) && !/sand|dust|snow|blizzard/i.test(calendaria?.id ?? '')
    || Object.values(fx ?? {}).some((e) => /lightning/i.test(String(e?.type ?? ''))) || !!fxLightning;
  return { wind, windAngle, temperature, storm, severity: storm ? stormSeverity({ calendaria, wind, fxLightning }) : 0 };
}

// How fierce a storm is (0.15 – 1): Calendaria's rain (its precipitation intensity, 0–1) and wind (0–1) when it gives
// them; else how often FXMaster's own lightning flashes (`fxLightning`, its filter: `options.frequency` ms apart, 1.5 s
// the worst, 15 s and slower the mildest); else a middling storm.
export function stormSeverity({ calendaria = null, wind = 0, fxLightning = null } = {}) {
  const clamp = (v) => Math.min(1, Math.max(0.15, v));
  const rain = Number(calendaria?.precipitation?.intensity);
  if (Number.isFinite(rain) && rain > 0) return clamp(0.2 + 0.55 * rain + 0.25 * (Number(wind) || 0));
  const every = Number(fxLightning?.options?.frequency ?? fxLightning?.frequency);
  if (Number.isFinite(every) && every > 0) return clamp(1 - (every - 1500) / 13500);
  return 0.55;
}

// How cloudy (0 clear – 1 overcast) from the clock's sky (sun.mjs skyClear: 1 clear, 0 black).
export const cloudCover = (sky) => (Number.isFinite(sky) ? Math.min(1, Math.max(0, 1 - sky)) : 0);

/**
 * How strongly the air shimmers over hot ground (0 none – 1 a desert noon): a sun high and clear, and either the
 * weather hot (from 28 °C, full by 38) or, the temperature unknown, the ground itself hot (sand, a desert).
 */
export function heatOf({ sun = null, sky = 1, temperature = null, hotGround = false } = {}) {
  if (!sun || sun.moon) return 0;
  const high = Math.min(1, Math.max(0, ((Number(sun.height) || 0) - 40) / 25));
  const clear = Math.min(1, Math.max(0, ((Number.isFinite(sky) ? sky : 1) - 0.6) / 0.3));
  const hot = temperature !== null ? Math.min(1, Math.max(0, (temperature - 28) / 10)) : hotGround ? 0.8 : 0;
  return high * clear * hot * Math.min(1, Math.max(0, Number(sun.strength) || 0));
}

const SURFACE_OF = { water: 'water', snow: 'frozen', ice: 'frozen', sand: 'hot', grass: 'grass' };
// The floors fireflies come out over: grass, and an outdoor scene's dirt (most outdoor maps are grassy).
const GRASSY = new Set(['grass', 'dirt']);
/**
 * Where the map's surfaces lie: { water, frozen, hot, grass } polygon lists (flat x, y pairs) from the regions with a
 * floor (movement-feel.mjs regionFloor), `bare` the regions with any other floor, and `whole`: the surface the scene's
 * own floor gives everywhere else ('frozen' for a snowy scene, 'hot' for a sandy one, else null), `grassAll` whether it
 * is grassy. `regions`: [{ floor, polygons }]; a polygon's `holes` (flat x, y pairs each) the holes drawn in it.
 */
export function surfacesOf({ sceneFloor = null, regions = [] } = {}) {
  const out = { water: [], frozen: [], hot: [], grass: [], bare: [], whole: SURFACE_OF[sceneFloor] ?? null, grassAll: GRASSY.has(sceneFloor) };
  if (out.whole === 'water' || out.whole === 'grass') out.whole = null;
  for (const r of regions ?? []) {
    const kind = SURFACE_OF[r?.floor], polygons = (r?.polygons ?? []).filter((p) => p?.length >= 6);
    if (kind) out[kind].push(...polygons);
    if (r?.floor && r.floor !== 'grass') out.bare.push(...polygons);
  }
  return out;
}

/**
 * A lightning flash's brightness (0–1) `ms` after it struck: a hard first flash, a dip, a second flicker and a fade,
 * about half a second in all.
 */
export function flashLevel(ms) {
  if (!(ms >= 0) || ms > 600) return 0;
  if (ms < 60) return ms / 60;
  if (ms < 140) return 1 - 0.75 * (ms - 60) / 80;
  if (ms < 190) return 0.25 + 0.6 * (ms - 140) / 50;
  return 0.85 * Math.max(0, 1 - (ms - 190) / 410) ** 2;
}
// The wait before the next strike in a storm, in ms, from a random number 0–1 and the storm's severity (0–1): a mild
// storm every 15 to 35 s, the worst every 3 to 10 s.
export const nextStrikeMs = (random, severity = 0.55) => {
  const s = Math.min(1, Math.max(0, Number(severity) || 0)), r = Math.min(1, Math.max(0, Number(random) || 0));
  return Math.round(15000 - 12000 * s + (20000 - 13000 * s) * r);
};
// How bright one strike flashes (0–1, the flash's full strength 1): a mild storm's dimmer, and each strike nearer or
// further (a random number 0–1: 0 a distant one at about half).
export const strikeStrength = (random, severity = 0.55) => {
  const s = Math.min(1, Math.max(0, Number(severity) || 0)), r = Math.min(1, Math.max(0, Number(random) || 0));
  return (0.5 + 0.5 * s) * (0.55 + 0.45 * r);
};
// The share of strikes followed at once by another (300 to 900 ms later), the worse the storm the more.
export const doubleStrike = (severity = 0.55) => 0.3 * Math.min(1, Math.max(0, Number(severity) || 0));

const VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec2 aUvs;
uniform mat3 translationMatrix, projectionMatrix;
varying vec2 vUv;
void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
// Four passes. uMode 3, the birds' shadows (drawn over the map, the roofs and the trees). Three over the open ground:
// uMode 0, shade (drawn over the map): the clouds' shadows and wet ground darkening. uMode 1, light (added): sheen and
// glints on water, sparkle on snow and ice, puddles catching
// the sky, rain's rings on the water and the puddles, and fireflies.
// uMode 2, pale (drawn over the map): morning mist and lying snow.
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uWater, uBanks, uFrozen, uIndoor, uGrass, uBare, uLow, uRoofShown, uSunlit, uTreeShade;
uniform vec2 uSize, uWindDir;
uniform vec4 uBird;     // a flock's centre (x, y), heading (radians) and whether it flies (w)
uniform float uTime, uWind, uStrength, uClouds, uGrid, uMode, uFrozenAll, uGrassAll, uWet, uSnow, uMist, uFireflies, uRain;
uniform vec3 uColor;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
float twinkle(vec2 p, float cell, float t, float rate){
  vec2 c = floor(p / cell), f = fract(p / cell) - 0.5;
  float h = hash(c), on = pow(max(0.0, sin(t * rate * (0.6 + h) + h * 40.0)), 10.0);
  return on * (1.0 - smoothstep(0.04, 0.16, length(f - (vec2(hash(c + 3.1), hash(c + 7.7)) - 0.5) * 0.6)));
}
// The sun caught on wavelet crests: short bright streaks lying across the wind, each flashing for a moment and gone,
// many at once when the wind ruffles the water. 0–1.
float crestGlints(vec2 px, float t){
  vec2 side = vec2(-uWindDir.y, uWindDir.x);
  // Crests travel with the wind; the pattern is laid along it (q.x) and across it (q.y).
  vec2 q = vec2(dot(px, uWindDir) - t * uGrid * (0.15 + 0.35 * uWind), dot(px, side));
  float cell = uGrid * 0.06, best = 0.0;
  vec2 c0 = floor(q / cell);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 c = c0 + vec2(float(i), float(j));
    float h = hash(c), h2 = hash(c + 5.7), h3 = hash(c + 8.3);
    if (h > 0.2 + 0.25 * uWind) continue;
    // Only some wavelets face the sun at any moment: a quick flash, then dark; some bright, most faint.
    float flash = pow(max(0.0, sin(t * (5.0 + 7.0 * h2) + h * 50.0)), 6.0) * (0.35 + 0.65 * h3);
    vec2 at = (c + 0.2 + 0.6 * vec2(hash(c + 1.3), hash(c + 2.9))) * cell;
    vec2 d = q - at;
    // Tiny: a point, or a short sliver across the wind on a longer crest; leaning a little either way.
    float lean = (h2 - 0.5) * 0.8;
    d = vec2(d.x + d.y * lean, d.y);
    float size = cell * (0.06 + 0.07 * h3);
    // A hot core and a soft bloom around it, as the sun is too bright to look at.
    float r = length(vec2(d.x / size, d.y / (size * (1.0 + 2.5 * h2))));
    float bloom = 1.0 - smoothstep(0.0, 4.0, r);
    float spark = (1.0 - smoothstep(0.4, 1.0, r)) + 0.45 * bloom * bloom;
    best = max(best, spark * flash);
  }
  // The glitter gathers in one or two bright areas where the swell tilts the water to the sun, shifting slowly.
  float patches = smoothstep(0.45, 0.72, noise(q / (uGrid * 3.5) + vec2(t * 0.04, -t * 0.03)));
  return best * patches;
}
// One bird's shadow seen from above, in squares from its middle (u.x ahead, u.y to its side): a slim body and head, a
// short tail, and two wings swept back and gently crooked, each tapering to its tip. 'beat' (0 wings level – 1 raised
// or lowered) foreshortens them from above. Soft: a bird flies high.
float birdShape(vec2 u, float beat){
  float span = 0.42 * (1.0 - 0.35 * beat), y = abs(u.y), along = y / span;
  // The body, its head well ahead of the wings.
  float body = 1.0 - smoothstep(0.8, 1.1, length(vec2((u.x - 0.03) / 0.14, u.y / 0.04)));
  float tail = (1.0 - smoothstep(0.0, 0.03, abs(u.y) - 0.025 * (1.0 + (-u.x - 0.08) / 0.07))) * step(-0.17, u.x) * step(u.x, -0.06);
  // The wing's leading edge: back from the shoulder, crooked at the wrist, swept to the tip.
  float edge = 0.05 - 0.14 * along + 0.09 * sin(along * 3.1416);
  float chord = 0.1 * (1.0 - along) + 0.02;
  float wing = (1.0 - smoothstep(0.85, 1.0, along)) * (1.0 - smoothstep(0.0, 0.012, abs(u.x - (edge - chord * 0.5)) - chord * 0.5));
  return max(max(body, tail), wing);
}
void main(){
  vec2 px = vUv * uSize;
  float outside = 1.0 - texture2D(uIndoor, vUv).a, t = uTime;
  float water = texture2D(uWater, vUv).a;
  // Where grass grows: the fireflies' meadows.
  float meadow = max(texture2D(uGrass, vUv).a, uGrassAll * (1.0 - texture2D(uBare, vUv).a)) * (1.0 - water) * outside;
  if (uMode > 2.5) {
    // A flock in a loose V, each bird's shadow beating its wings; drawn over the roofs and trees too ('above').
    float birds = 0.0;
    if (uBird.w > 0.5) {
      vec2 fwd = vec2(cos(uBird.z), sin(uBird.z)), side = vec2(-fwd.y, fwd.x);
      for (int i = 0; i < 7; i++) {
        float fi = float(i), row = floor((fi + 1.0) / 2.0), s = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
        vec2 at = uBird.xy - fwd * row * uGrid * 0.9 + side * s * row * uGrid * 0.75 + side * sin(t * 0.7 + fi) * uGrid * 0.12;
        vec2 d = px - at; d = vec2(dot(d, fwd), dot(d, side)) / uGrid;
        // Each beats its wings on its own rhythm, now and then gliding.
        float beat = abs(sin(t * 6.0 + fi * 1.9)) * smoothstep(-0.3, 0.3, sin(t * 0.8 + fi * 2.3));
        birds = max(birds, birdShape(d, beat));
      }
    }
    // Indoors, only over a roof as it is drawn now: a roof faded for a creature inside shows the room, and no birds.
    float inside = texture2D(uIndoor, vUv).a, roof = texture2D(uRoofShown, vUv).a;
    // Dark enough to read on a tree's dark leaves too, not only on open ground.
    float a = birds * 0.7 * uStrength * max(1.0 - inside, roof);
    gl_FragColor = vec4(vec3(0.04, 0.05, 0.06) * a, a);
    return;
  }
  if (uMode < 0.5) {
    float a = 0.0;
    if (uClouds > 0.05) {
      // Clouds some nine squares across, drifting the way the wind blows; more of them the cloudier.
      vec2 q = px / (uGrid * 9.0) - uWindDir * t * (0.01 + 0.05 * uWind);
      float edge = 1.0 - uClouds;
      a = smoothstep(edge - 0.05, edge + 0.07, fbm(q)) * outside * 0.4 * uStrength;
    }
    // Wet ground darkens.
    a = 1.0 - (1.0 - a) * (1.0 - uWet * 0.2 * outside * (1.0 - water));
    gl_FragColor = vec4(vec3(0.04, 0.05, 0.06) * a, a);
    return;
  }
  if (uMode > 1.5) {
    vec3 col = vec3(0.0); float a = 0.0;
    if (uSnow > 0.01) {
      // Snow lies first in patches, then everywhere open; not on water.
      float lie = smoothstep(1.0 - uSnow * 1.15, 1.05 - uSnow * 1.15, fbm(px / (uGrid * 4.0))) * outside * (1.0 - water);
      // Thin enough for the ground to show through where it lies light, crusted and drifted where it lies deep.
      float grain = noise(px / (uGrid * 0.25)), drift = noise(px / (uGrid * 1.1));
      float s = lie * (0.3 + 0.3 * uSnow) * (0.7 + 0.2 * grain + 0.25 * drift);
      col = mix(vec3(0.82, 0.88, 0.97), vec3(0.97, 0.98, 1.0), drift) * s; a = s;
    }
    if (uMist > 0.01) {
      // Mist lies thickest over water and low ground, thinner elsewhere, drifting slowly.
      float low = texture2D(uLow, vUv).a;
      float m = uMist * (0.45 + 0.55 * low) * smoothstep(0.25, 0.65, fbm(px / (uGrid * 6.0) + uWindDir * t * 0.015 + vec2(t * 0.004, 0.0))) * outside * 0.6;
      col = col * (1.0 - m) + vec3(0.86, 0.89, 0.92) * m; a = 1.0 - (1.0 - a) * (1.0 - m);
    }
    gl_FragColor = vec4(col, a);
    return;
  }
  vec3 col = vec3(0.0);
  float banks = texture2D(uBanks, vUv).a * (1.0 - water);
  float frozen = max(texture2D(uFrozen, vUv).a, uFrozenAll) * (1.0 - water);
  if (uStrength > 0.02) {
    float light = 0.0;
    // Where the sun reaches the water: not in a wall's shadow (the sunlit floor), not under the trees' shade.
    float sunny = texture2D(uSunlit, vUv).a * (1.0 - 0.9 * texture2D(uTreeShade, vUv).a);
    if (water > 0.01 && sunny > 0.02) {
      vec2 side = vec2(-uWindDir.y, uWindDir.x);
      // Sheen: broad, soft brightness where the surface tilts toward the sun, drifting slowly; strongest on calm water,
      // where it mirrors the sky.
      vec2 w = px / (uGrid * 4.0) + uWindDir * t * (0.02 + 0.06 * uWind);
      float sheen = smoothstep(0.5, 0.85, fbm(w + vec2(t * 0.01, 0.0)));
      // The wavelets themselves: fine crests across the wind, travelling with it, faintly lit.
      vec2 f = vec2(dot(px, uWindDir) / (uGrid * 0.12) - t * (1.5 + 3.0 * uWind), dot(px, side) / (uGrid * 0.5));
      float crests = smoothstep(0.62, 0.8, noise(f) * 0.7 + noise(f * 2.3 + 3.1) * 0.3);
      // Glints gather where the sheen tilts the surface to the sun, and spread with the wind.
      float glints = crestGlints(px, t) * (0.35 + 0.65 * sheen);
      light += water * sunny * (sheen * (0.14 - 0.06 * uWind) + crests * (0.03 + 0.04 * uWind) + glints * 3.0);
    }
    if (frozen > 0.01) light += frozen * twinkle(px, uGrid * 0.12, t, 1.6) * 0.7;
    // Puddles on wet ground catch the sky.
    if (uWet > 0.05) light += uWet * smoothstep(0.68, 0.72, fbm(px / (uGrid * 1.4))) * outside * (1.0 - water) * 0.1;
    col += uColor * light * outside * uStrength;
  }
  if (uRain > 0.01) {
    // Rain on water and on the puddles: a ring spreading where each drop lands, more the harder it rains.
    float puddle = uWet > 0.05 ? smoothstep(0.68, 0.72, fbm(px / (uGrid * 1.4))) * (1.0 - water) : 0.0;
    float pool = max(water, puddle) * outside;
    if (pool > 0.01) {
      float cell = uGrid * 0.28, rings = 0.0;
      vec2 c0 = floor(px / cell);
      for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
        vec2 c = c0 + vec2(float(i), float(j));
        float h = hash(c + 11.3);
        if (h > uRain) continue;
        float age = fract(t * (0.9 + 0.6 * h) + h * 17.0);
        vec2 drop = (c + 0.5 + (vec2(hash(c + 1.9), hash(c + 4.7)) - 0.5) * 0.7) * cell;
        float d = length(px - drop);
        rings += (1.0 - smoothstep(0.0, cell * 0.06, abs(d - age * cell * 0.9))) * (1.0 - age);
      }
      col += vec3(0.8, 0.85, 0.9) * rings * pool * 0.35;
    }
  }
  if (uFireflies > 0.01) {
    // Fireflies over the grass and the banks: each wanders on its own slow loop and glows now and then.
    float place = max(meadow, banks) + 0.25 * outside;
    vec2 cellSize = vec2(uGrid * 1.3);
    vec2 c0 = floor(px / cellSize);
    float glow = 0.0;
    for (int i = 0; i <= 1; i++) for (int j = 0; j <= 1; j++) {
      vec2 c = c0 + vec2(float(i), float(j)) - 0.5;
      float h = hash(c + 5.3);
      if (h > 0.55) continue;
      vec2 at = (c + 0.5 + 0.35 * vec2(sin(t * (0.2 + 0.2 * h) + h * 20.0), cos(t * (0.17 + 0.2 * h) + h * 11.0))) * cellSize;
      float pulse = pow(max(0.0, sin(t * (0.8 + h) + h * 30.0)), 3.0);
      float d = length(px - at);
      glow += pulse * ((1.0 - smoothstep(0.0, uGrid * 0.06, d)) + 0.5 * (1.0 - smoothstep(0.0, uGrid * 0.25, d)));
    }
    col += vec3(0.75, 1.0, 0.35) * glow * place * uFireflies;
  }
  float a = max(col.r, max(col.g, col.b));
  gl_FragColor = vec4(col, a);
}`;

const RESOLUTION = 0.25, MAX_TEXTURE = 2048;

/**
 * The life over the map's open ground. build({ water, frozen, frozenAll, grass, bare, grassAll, indoors, bounds, grid })
 * bakes the polygon lists into soft masks (`grass` the grassy regions, `bare` the regions with another floor, which
 * `grassAll`, a grassy scene, leaves out: where fireflies come out); look({ light, clouds, color, wind, windAngle, wet, snow, mist,
 * fireflies, rain }) sets the hour and weather (light: the sun's or moon's strength); bird(flock) flies a flock ({ x, y,
 * angle }, null none), its shadow drawn in `above()` (over the overhead tiles); indoors only over `roofs` as they are drawn
 * now (each tile's picture, { texture, x, y, width, height, rotation, anchorX, anchorY, shown 0–1 }); tick(seconds) moves
 * it all.
 */
export function createSurfaceLight({ PIXI, root, render, above = root }) {
  let masks = [], meshes = [], own = [], hasGlints = false, hasWater = false, origin = { x: 0, y: 0 }, area = null, roofShown = null;
  const drop = () => {
    for (const m of meshes) { try { m.parent?.removeChild(m); m.destroy(); } catch { /* gone with the canvas */ } }
    for (const m of masks) { try { m.destroy(true); } catch { /* gone */ } }
    try { roofShown?.destroy(true); } catch { /* gone */ }
    meshes = []; masks = []; own = []; area = null; roofShown = null;
  };
  // The roofs as drawn now (each faded as far as Foundry fades it), into a small picture the birds' pass reads.
  const drawRoofs = (roofs) => {
    if (!area) return;
    roofShown ??= PIXI.RenderTexture.create({ width: area.w, height: area.h });
    const stage = new PIXI.Container(), { k, bounds } = area;
    for (const t of roofs) {
      if (!t?.texture || !(t.shown > 0.01)) continue;
      const s = new PIXI.Sprite(t.texture);
      s.anchor.set(t.anchorX ?? 0.5, t.anchorY ?? 0.5);
      s.position.set((t.x - bounds.x) * k, (t.y - bounds.y) * k);
      s.width = Math.abs(t.width) * k; s.height = Math.abs(t.height) * k;
      s.rotation = t.rotation ?? 0;
      s.alpha = t.shown;
      stage.addChild(s);
    }
    try { render(stage, roofShown); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
    for (const u of own) u.uRoofShown = roofShown;
  };
  const set = (values) => { for (const u of own) Object.assign(u, values); };
  return {
    build({ water = [], frozen = [], frozenAll = false, grass = [], bare = [], grassAll = false, indoors = [], bounds, grid = 100 } = {}) {
      drop();
      if (!bounds) return;
      const k = Math.min(RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      const bake = (list, blur) => {
        const stage = new PIXI.Container(), g = new PIXI.Graphics();
        for (const p of list) { const at = (q) => q.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k); g.beginFill(0xffffff, 1); g.drawPolygon(at(p)); for (const hole of p.holes ?? []) { g.beginHole(); g.drawPolygon(at(hole)); g.endHole(); } g.endFill(); }
        stage.addChild(g);
        stage.filters = [new PIXI.BlurFilter(blur)];
        const texture = PIXI.RenderTexture.create({ width: w, height: h });
        try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
        masks.push(texture);
        return texture;
      };
      origin = { x: bounds.x, y: bounds.y };
      area = { k: k * 0.5, bounds, w: Math.max(1, Math.ceil(bounds.width * k * 0.5)), h: Math.max(1, Math.ceil(bounds.height * k * 0.5)) };
      hasGlints = water.length > 0 || frozen.length > 0 || frozenAll;
      hasWater = water.length > 0;
      // The banks: a wider, softer water, so the ripples' light spills a little onto the ground beside it; the low
      // ground the mist gathers on: wider still.
      const uniforms = {
        uWater: bake(water, 1), uBanks: bake(water, 6 + grid * k * 0.25), uLow: bake(water, 10 + grid * k * 1.5), uFrozen: bake(frozen, 2), uIndoor: bake(indoors, 1),
        uGrass: bake(grass, 2), uBare: bake(bare, 2), uRoofShown: PIXI.Texture.EMPTY, uSunlit: PIXI.Texture.WHITE, uTreeShade: PIXI.Texture.EMPTY,
        uSize: [bounds.width, bounds.height], uWindDir: [Math.SQRT1_2, Math.SQRT1_2], uBird: [0, 0, 0, 0], uTime: 0, uWind: 0.3, uStrength: 0, uClouds: 0,
        uGrid: grid, uMode: 0, uFrozenAll: frozenAll ? 1 : 0, uGrassAll: grassAll ? 1 : 0, uWet: 0, uSnow: 0, uMist: 0, uFireflies: 0, uRain: 0, uColor: [1, 0.95, 0.84],
      };
      const geometry = new PIXI.Geometry()
        .addAttribute('aVertexPosition', [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height, bounds.x, bounds.y + bounds.height], 2)
        .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
      own = [uniforms, { ...uniforms, uMode: 1 }, { ...uniforms, uMode: 2 }, { ...uniforms, uMode: 3 }];
      const shade = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[0]));
      const light = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[1]));
      const pale = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[2]));
      const flock = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[3]));
      light.blendMode = PIXI.BLEND_MODES.ADD;
      meshes = [shade, light, pale, flock];
      for (const m of meshes) { m.eventMode = 'none'; m.visible = false; (m === flock ? above : root)().addChild(m); }
    },
    look({ light = 0, clouds = 0, color = [1, 0.95, 0.84], wind = 0.3, windAngle = Math.PI / 4, wet = 0, snow = 0, mist = 0, fireflies = 0, rain = 0 } = {}) {
      if (!own.length) return;
      const sunny = light > 0.02;
      set({ uStrength: sunny ? light : 0, uClouds: clouds, uColor: color, uWind: wind, uWindDir: [Math.cos(windAngle), Math.sin(windAngle)], uWet: wet, uSnow: snow, uMist: mist, uFireflies: fireflies, uRain: rain });
      meshes[0].visible = (sunny && clouds > 0.05) || wet > 0.02;
      meshes[3].visible = sunny && own[0].uBird[3] > 0.5;
      meshes[1].visible = (sunny && (hasGlints || wet > 0.05)) || fireflies > 0.01 || (rain > 0.01 && (hasWater || wet > 0.05));
      meshes[2].visible = snow > 0.01 || mist > 0.01;
    },
    bird(flock, roofs = []) {
      if (!own.length) return;
      if (flock) drawRoofs(roofs);
      set({ uBird: flock ? [flock.x - origin.x, flock.y - origin.y, flock.angle, 1] : [0, 0, 0, 0] });
      meshes[3].visible = !!flock && own[0].uStrength > 0.02;
    },
    // Where the sun reaches, for the water's light: `sunlit` the wall shadows' sunlit floor (null: everywhere), `trees`
    // the trees' baked shade (null: none); both over the same scene rectangle as the rest.
    shade({ sunlit = null, trees = null } = {}) { set({ uSunlit: sunlit ?? PIXI.Texture.WHITE, uTreeShade: trees ?? PIXI.Texture.EMPTY }); },
    tick(seconds) { for (const u of own) u.uTime += seconds; },
    clear: drop,
    get shown() { return meshes.some((m) => m.visible); },
  };
}

// The air over hot ground bends what lies under it: a small, slow wobble of the map, there only where it is hot.
const SHIMMER = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler, uHot;
uniform vec4 inputSize, outputFrame;
uniform vec3 uView;     // the stage's offset (x, y) and scale: screen = world * scale + offset
uniform vec4 uBounds;   // the scene's rectangle in world pixels
uniform float uTime, uAmp, uHotAll;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 screen = vTextureCoord * inputSize.xy + outputFrame.xy;
  vec2 world = (screen - uView.xy) / uView.z;
  vec2 uv = (world - uBounds.xy) / uBounds.zw;
  float hot = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : max(texture2D(uHot, uv).a, uHotAll);
  vec2 shift = vec2(0.0);
  if (hot > 0.01) {
    // Rising heat: wobbles that drift upward, finer across than along.
    vec2 q = world / vec2(60.0, 140.0) + vec2(0.0, uTime * 0.9);
    shift = vec2(noise(q) - 0.5, noise(q + 31.7) - 0.5) * uAmp * hot * uView.z;
  }
  gl_FragColor = texture2D(uSampler, vTextureCoord + shift * inputSize.zw);
}`;

/**
 * The shimmer over hot ground, one filter on the map (`attach`/`detach` put it on Foundry's primary group). build({
 * hot, hotAll, bounds }) bakes where the ground is hot; set({ heat, view }) sets how strong (0 takes it off) and the
 * stage's world-to-screen offset and scale this frame; tick(seconds) moves the air.
 */
export function createHeatShimmer({ PIXI, attach, detach, render }) {
  let filter = null, mask = null, attached = false;
  const off = () => { if (attached) { attached = false; try { detach(filter); } catch { /* gone */ } } };
  return {
    build({ hot = [], hotAll = false, bounds } = {}) {
      off();
      try { mask?.destroy(true); } catch { /* gone */ }
      mask = null;
      if (!bounds || (!hot.length && !hotAll)) return;
      const k = Math.min(0.125, 1024 / Math.max(1, bounds.width, bounds.height));
      const stage = new PIXI.Container(), g = new PIXI.Graphics();
      for (const p of hot) { const at = (q) => q.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k); g.beginFill(0xffffff, 1); g.drawPolygon(at(p)); for (const hole of p.holes ?? []) { g.beginHole(); g.drawPolygon(at(hole)); g.endHole(); } g.endFill(); }
      stage.addChild(g);
      stage.filters = [new PIXI.BlurFilter(2)];
      mask = PIXI.RenderTexture.create({ width: Math.max(1, Math.ceil(bounds.width * k)), height: Math.max(1, Math.ceil(bounds.height * k)) });
      try { render(stage, mask); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      filter ??= new PIXI.Filter(undefined, SHIMMER, { uHot: PIXI.Texture.EMPTY, uView: [0, 0, 1], uBounds: [0, 0, 1, 1], uTime: 0, uAmp: 0, uHotAll: 0 });
      Object.assign(filter.uniforms, { uHot: mask, uBounds: [bounds.x, bounds.y, bounds.width, bounds.height], uHotAll: hotAll ? 1 : 0 });
    },
    set({ heat = 0, view = null } = {}) {
      if (!filter || !mask || !(heat > 0.03) || !view) { off(); return; }
      filter.uniforms.uAmp = 2.5 * heat;
      filter.uniforms.uView = [view.x, view.y, view.scale];
      if (!attached) { try { attach(filter); attached = true; } catch { /* no canvas */ } }
    },
    tick(seconds) { if (filter && attached) filter.uniforms.uTime += seconds; },
    clear() { off(); try { mask?.destroy(true); } catch { /* gone */ } mask = null; },
    get on() { return attached; },
  };
}

/**
 * Lightning: a cold white flash over the whole map (`root` returns the container over the lighting), struck now and
 * then while `storm` says there is one. tick(ms) runs it on the client's clock; strike() flashes at once.
 */
// What a flash lights (0–1 in the alpha, white): the open map whole; inside the rooms (`indoors`) only a little bounced
// light, and the patches through their windows (`windows`, wall-shadows.mjs windowFlashes); a roof as drawn now
// (`roofs`, each with its `shown` alpha) flashes as the open map does, its room hidden under it.
const FLASH_VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec2 aUvs;
uniform mat3 translationMatrix, projectionMatrix;
varying vec2 vUv;
void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
const FLASH_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uLit;
uniform vec3 uColor;
uniform float uAlpha;
void main(){ float a = texture2D(uLit, vUv).a * uAlpha; gl_FragColor = vec4(uColor * a, a); }`;
// How much of a flash reaches a room's floor away from its windows.
const BOUNCED = 0.12;
export function createLightningFlash({ PIXI, root, bounds, random = Math.random, render = null, cover = null }) {
  let sprite = null, lit = null, struckAt = null, nextAt = null, strength = 1;
  const drop = () => {
    try { sprite?.destroy(); } catch { /* gone with the canvas */ }
    try { lit?.destroy(true); } catch { /* gone */ }
    sprite = null; lit = null;
  };
  // At each strike: the map as the flash lights it, rooms and all; null (a plain flash over everything) with no rooms.
  const bake = () => {
    const r = bounds(), what = typeof cover === 'function' ? cover() : null;
    if (!render || !r || !what?.indoors?.length || typeof PIXI.Mesh !== 'function') return null;
    const k = Math.min(RESOLUTION, MAX_TEXTURE / Math.max(1, r.width, r.height));
    const w = Math.max(1, Math.ceil(r.width * k)), h = Math.max(1, Math.ceil(r.height * k));
    const at = (p) => p.map((v, i) => (v - (i % 2 ? r.y : r.x)) * k);
    const stage = new PIXI.Container(), open = new PIXI.Graphics(), rooms = new PIXI.Graphics(), through = new PIXI.Graphics();
    open.beginFill(0xffffff, 1); open.drawRect(0, 0, w, h); open.endFill();
    // The rooms dimmed to their bounced light; their holes (a courtyard) stay open.
    rooms.blendMode = PIXI.BLEND_MODES.ERASE;
    for (const p of what.indoors) { rooms.beginFill(0xffffff, 1 - BOUNCED); rooms.drawPolygon(at(p)); for (const hole of p.holes ?? []) { rooms.beginHole(); rooms.drawPolygon(at(hole)); rooms.endHole(); } rooms.endFill(); }
    // Each window's patch, brightest at the opening.
    through.blendMode = PIXI.BLEND_MODES.ADD;
    const lerp = (p, q, t) => p + (q - p) * t, SLICES = 10;
    for (const win of what.windows ?? []) {
      const [ax, ay, bx, by, cx, cy, ex, ey] = win.points;
      for (let i = 0; i < SLICES; i++) {
        const t0 = i / SLICES, t1 = (i + 1) / SLICES;
        through.beginFill(0xffffff, (win.alpha ?? 1) * (0.85 - 0.7 * (i + 0.5) / SLICES));
        through.drawPolygon(at([lerp(ax, ex, t0), lerp(ay, ey, t0), lerp(bx, cx, t0), lerp(by, cy, t0), lerp(bx, cx, t1), lerp(by, cy, t1), lerp(ax, ex, t1), lerp(ay, ey, t1)]));
        through.endFill();
      }
    }
    stage.addChild(open, rooms, through);
    // The roofs as drawn now: the flash falls on them as on the open map.
    for (const t of what.roofs ?? []) {
      if (!t?.texture || !(t.shown > 0.01)) continue;
      const roof = new PIXI.Sprite(t.texture);
      roof.anchor.set(t.anchorX ?? 0.5, t.anchorY ?? 0.5);
      roof.position.set((t.x - r.x) * k, (t.y - r.y) * k);
      roof.width = Math.abs(t.width) * k; roof.height = Math.abs(t.height) * k;
      roof.rotation = t.rotation ?? 0; roof.alpha = t.shown;
      stage.addChild(roof);
    }
    stage.filters = [new PIXI.BlurFilter(4)];
    const texture = PIXI.RenderTexture.create({ width: w, height: h });
    try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
    return { texture, r, u: (r.width * k) / w, v: (r.height * k) / h };
  };
  const ensure = (fresh) => {
    if (sprite && !sprite.destroyed && !fresh) return sprite;
    drop();
    const baked = bake();
    if (baked) {
      lit = baked.texture;
      const { r, u, v } = baked, geometry = new PIXI.Geometry()
        .addAttribute('aVertexPosition', [r.x, r.y, r.x + r.width, r.y, r.x + r.width, r.y + r.height, r.x, r.y + r.height], 2)
        .addAttribute('aUvs', [0, 0, u, 0, u, v, 0, v], 2).addIndex([0, 1, 2, 0, 2, 3]);
      const c = new PIXI.Color(0xdfe8ff);
      sprite = new PIXI.Mesh(geometry, PIXI.Shader.from(FLASH_VERT, FLASH_FRAG, { uLit: lit, uColor: [c.red, c.green, c.blue], uAlpha: 0 }));
      sprite.lit = true;
    } else {
      sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
      sprite.tint = 0xdfe8ff;
    }
    sprite.eventMode = 'none';
    sprite.blendMode = PIXI.BLEND_MODES.ADD;
    sprite.alpha = 0;
    // Over the dawn and dusk colour (99990), under FXMaster's weather (100000).
    sprite.zIndex = 99995;
    root().addChild(sprite);
    root().sortChildren?.();
    return sprite;
  };
  return {
    // `storm`: how fierce the storm is now (0 or false: none; true: a middling one). Returns how bright the flash is
    // now (0–1, by the strike's own strength).
    tick(now, storm) {
      let fresh = false;
      const severity = storm === true ? 0.55 : Number(storm) || 0;
      if (!(severity > 0)) { nextAt = null; if (struckAt === null && sprite) sprite.visible = false; }
      else if (nextAt === null) nextAt = now + nextStrikeMs(random(), severity);
      else if (now >= nextAt) {
        struckAt = now; fresh = true; strength = strikeStrength(random(), severity);
        nextAt = now + (random() < doubleStrike(severity) ? 300 + 600 * random() : nextStrikeMs(random(), severity));
      }
      if (struckAt === null) return 0;
      const level = flashLevel(now - struckAt) * strength;
      const s = ensure(fresh || this.rebake === true);
      this.rebake = false;
      if (s.lit) { s.shader.uniforms.uAlpha = 0.55 * level; s.alpha = 1; }
      else { const r = bounds(); s.position.set(r.x, r.y); s.width = r.width; s.height = r.height; s.alpha = 0.55 * level; }
      s.visible = level > 0;
      if (level <= 0 && now - struckAt > 600) struckAt = null;
      return level;
    },
    strike(now) { struckAt = now; strength = 1; this.rebake = true; },
    clear() { drop(); struckAt = null; nextAt = null; },
  };
}

// Snow lying on the roofs and in the trees after snowfall, as on the ground (the ground's snow, 0–1): a roof holds all
// of it; a tree's leaves less, and shed it in a wind. 0–1.
export function tileSnowOf(snow, { kind = 'roof', wind = 0 } = {}) {
  const s = Math.min(1, Math.max(0, Number(snow) || 0));
  if (kind !== 'tree') return s;
  return s * 0.85 * (1 - 0.4 * Math.min(1, Math.max(0, Number(wind) || 0)));
}

const TILE_SNOW_VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec2 aUvs;
uniform mat3 translationMatrix, projectionMatrix;
varying vec2 vUv, vWorld;
void main(){ vUv = aUvs; vWorld = aVertexPosition; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
const TILE_SNOW_FRAG = `
precision highp float;
varying vec2 vUv, vWorld;
uniform sampler2D uTile;
uniform float uAmount, uShown, uTree, uGrid;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  vec4 c = texture2D(uTile, vUv);
  if (c.a < 0.05 || uAmount < 0.01) { gl_FragColor = vec4(0.0); return; }
  vec3 own = c.rgb / c.a;
  float luma = dot(own, vec3(0.3, 0.59, 0.11));
  // Drifts over the whole tile and a fine grain, fixed to the map.
  float drift = noise(vWorld / (uGrid * 0.6)) * 0.65 + noise(vWorld / (uGrid * 0.18)) * 0.35;
  // A soft grain, two fine layers blended so it never reads as blocks.
  float grain = noise(vWorld / (uGrid * 0.11)) * 0.6 + noise(vWorld / (uGrid * 0.035)) * 0.4;
  // The tile's own light and dark: its shingle rows and ridges, its leaf clumps.
  float lit = smoothstep(0.08, 0.5, luma);
  float cover;
  if (uTree > 0.5) {
    // Caught on the tops of the leaves (the lit, brighter clumps), never in the dark gaps between them.
    float tops = smoothstep(0.18, 0.5, luma + 0.2 * (drift - 0.5));
    cover = tops * smoothstep(0.05, 0.55, uAmount + 0.3 * (drift - 0.5) + 0.1 * (grain - 0.5));
  } else {
    // A blanket that thins in places as it first falls; the roof's dark lines (ridges, the gaps between shingle rows)
    // hold less, showing its shape, until a deep snow all but buries them (however dark the roof).
    float deep = smoothstep(0.5, 1.0, uAmount);
    cover = smoothstep(0.08, 0.55, uAmount + 0.35 * (drift - 0.5) + 0.08 * (grain - 0.5)) * mix(mix(0.45, 0.88, lit), mix(0.82, 0.96, lit), deep);
  }
  float a = cover * c.a * uShown;
  // Shaded by what it lies on: a little darker in the roof's grooves, less so as it deepens.
  float depth = uTree > 0.5 ? 0.0 : smoothstep(0.5, 1.0, uAmount);
  vec3 snow = vec3(0.9, 0.93, 0.98) * (0.86 + 0.1 * grain) * mix(mix(0.8, 1.0, lit), 0.97, depth);
  gl_FragColor = vec4(snow * a, a);
}`;

// Snow on the overhead tiles: one mesh a roof or tree tile, reading the tile's own picture (its leaves, its roof),
// over the tiles in `root()`. build({ tiles: [{ kind 'roof' | 'tree', texture, x, y, width, height, rotation, anchorX,
// anchorY, shown }], grid }) makes them; look({ snow, wind }) how much lies (the ground's snow, 0–1, and the wind 0–1);
// shown(values) each tile as drawn now (a roof faded for a creature inside takes its snow with it); clear() drops them.
// Hidden while no snow lies: nothing drawn.
export function createTileSnow({ PIXI, root }) {
  let meshes = [];
  const drop = () => {
    for (const m of meshes) { try { m.parent?.removeChild(m); m.destroy(); } catch { /* gone with the canvas */ } }
    meshes = [];
  };
  return {
    build({ tiles = [], grid = 100 } = {}) {
      drop();
      if (typeof PIXI?.Mesh !== 'function') return;
      for (const t of tiles) {
        if (!t?.texture?.valid && t?.texture?.valid !== undefined) continue;
        const w = Math.abs(Number(t.width) || 0), h = Math.abs(Number(t.height) || 0);
        if (!(w > 0 && h > 0)) continue;
        // The tile's corners on the map, turned about its anchor as Foundry draws it.
        const ax = t.anchorX ?? 0.5, ay = t.anchorY ?? 0.5, cos = Math.cos(t.rotation ?? 0), sin = Math.sin(t.rotation ?? 0);
        const corner = (u, v) => { const lx = (u - ax) * w, ly = (v - ay) * h; return [t.x + lx * cos - ly * sin, t.y + lx * sin + ly * cos]; };
        const uv = t.texture._uvs ?? { x0: 0, y0: 0, x1: 1, y1: 0, x2: 1, y2: 1, x3: 0, y3: 1 };
        const geometry = new PIXI.Geometry()
          .addAttribute('aVertexPosition', [...corner(0, 0), ...corner(1, 0), ...corner(1, 1), ...corner(0, 1)], 2)
          .addAttribute('aUvs', [uv.x0, uv.y0, uv.x1, uv.y1, uv.x2, uv.y2, uv.x3, uv.y3], 2).addIndex([0, 1, 2, 0, 2, 3]);
        const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(TILE_SNOW_VERT, TILE_SNOW_FRAG, { uTile: t.texture, uAmount: 0, uShown: Number.isFinite(t.shown) ? t.shown : 1, uTree: t.kind === 'tree' ? 1 : 0, uGrid: grid }));
        mesh.eventMode = 'none';
        mesh.visible = false;
        mesh.kind = t.kind;
        root().addChild(mesh);
        meshes.push(mesh);
      }
    },
    look({ snow = 0, wind = 0 } = {}) {
      for (const m of meshes) {
        const amount = tileSnowOf(snow, { kind: m.kind, wind });
        m.shader.uniforms.uAmount = amount;
        m.visible = amount > 0.01;
      }
    },
    shown(values = []) { meshes.forEach((m, i) => { if (Number.isFinite(values[i])) m.shader.uniforms.uShown = values[i]; }); },
    clear: drop,
    get built() { return meshes.length > 0; },
    get showing() { return meshes.some((m) => m.visible); },
  };
}
