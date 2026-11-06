import { weatherDrawn } from './sky-weather.mjs';
import { CLOUD_DECK } from './cloud-deck.mjs';
// The sky over the map: cloud shadows drifting with the wind, the sun glittering on water and rippling over its banks,
// snow and ice sparkling, the air shimmering over hot ground at midday, and lightning flashing in a storm. What the
// weather is and where each surface lies is pure; the light is drawn by one shader over the map (createSurfaceLight),
// the shimmer by one filter on it (createHeatShimmer) and the flash by one sprite over it (createLightningFlash).

// A scene's own wind (Scene configuration → Animater wind): how strong, against the weather's ('sheltered' halves it),
// and where it blows from (compass points, as a weather report gives them: a north wind comes from the north).
// The way what falls goes here (pure): 0 with the wind, 1 down the map, 2 seen from straight above. The scene's own say ("off", "on", "top"), else the module's setting.
export const fallWayHere = (flag, setting) => (flag === 'top' ? 2 : flag === 'on' || flag === true ? 1 : flag === 'off' ? 0 : setting === true ? 1 : 0);
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
  // Someone said how windy it is (the scene, or the calendar): a weather's least wind gives way to that.
  const windStated = Number.isFinite(speed) || own?.wind in SCENE_WINDS || own?.wind === 'sheltered';
  if (own?.wind in SCENE_WINDS) wind = SCENE_WINDS[own.wind];
  else if (own?.wind === 'sheltered') wind /= 2;
  const toward = Number(calendaria?.wind?.direction);
  // Calendaria's direction is where the wind comes from, in degrees clockwise from north: it blows the other way. With
  // none, a north-west wind.
  const windAngle = blowingFrom(own?.windFrom in WIND_FROM ? WIND_FROM[own.windFrom] : Number.isFinite(toward) ? toward : WIND_FROM.nw);
  const temperature = Number.isFinite(Number(calendaria?.temperature)) && calendaria?.temperature !== null ? Number(calendaria.temperature) : null;
  const named = `${calendaria?.id ?? ''} ${calendaria?.label ?? ''} ${scene ?? ''}`;
  const fxLightning = Object.values(fxFilters ?? {}).find((f) => /lightning/i.test(String(f?.type ?? '')));
  const storm = /thunder|lightning|storm/i.test(named.replace(/(sand|dust|snow|fire)[- ]?storm/gi, '')) && !/sand|dust|snow|blizzard/i.test(calendaria?.id ?? '')
    || Object.values(fx ?? {}).some((e) => /lightning/i.test(String(e?.type ?? ''))) || !!fxLightning;
  return { wind, windStated, windAngle, temperature, storm, severity: storm ? stormSeverity({ calendaria, wind, fxLightning }) : 0 };
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
// Whether a change to a scene means the sky's surfaces must be built again (pure). Its weather and the darkness only change how they are lit, which a look at the sky sees to at once; the ground's own record of rain and snow changes nothing here. `change` as updateScene gives it.
// The lights nearest a point, that give any light (pure): those the snow can afford to catch.
export function nearestLights(lights = [], at = { x: 0, y: 0 }, most = 4) {
  return lights.filter((l) => l.radius > 0).map((l) => ({ l, d: Math.hypot(l.x - at.x, l.y - at.y) - l.radius })).sort((a, b) => a.d - b.d).slice(0, most).map((e) => e.l);
}
// How dark a storm's sky makes the outdoors (pure, the strength of its wash): nothing even under plain overcast; only as the sky shuts altogether, to `most`, a little more in the rain. Only what daylight there is to lose: none at night, which is dark already. Only a look: it never touches the scene's darkness, so nobody's vision or the rules change.
export function stormGloom({ cover = 0, rain = 0, darkness = 0, most = 0.5 } = {}) {
  const k = Math.min(1, Math.max(0, (Number(cover) - 0.9) / 0.1)), day = 1 - Math.min(1, Math.max(0, Number(darkness) || 0));
  return Math.min(0.85, Math.max(0, Number(most) || 0) * (k * k * (3 - 2 * k)) * (1 + 0.25 * Math.min(1, Math.max(0, Number(rain) || 0)))) * day;
}
const LOOK_ONLY_FLAGS = new Set(['ground', 'weatherTune', 'fallsDown', 'weatherOff']);
export function skyNeedsBuilding(change = {}) {
  for (const key of Object.keys(change ?? {})) {
    if (key === '_id' || key === '_stats' || key === 'weather') continue;
    if (key === 'environment') { if (Object.keys(change.environment ?? {}).some((k) => k !== 'darknessLevel')) return true; continue; }
    if (key === 'flags') {
      for (const [scope, own] of Object.entries(change.flags ?? {})) if (scope !== 'animater' || Object.keys(own ?? {}).some((k) => !LOOK_ONLY_FLAGS.has(k))) return true;
      continue;
    }
    return true;
  }
  return false;
}
// How the cloud deck looks for a cover (pure), as [how much of the sky it takes, how heavy, how soft its gaps, how dim the whole scene]. It shows in what it does to the land: sunlit patches and firm shadows under a broken sky; dim and cool, with slow lighter patches, once it closes; darker again with rain falling from it.
const DRY_DECK = [[0, [0.1, 0, 0, 1]], [0.3, [0.42, 0, 0, 1]], [0.65, [0.62, 0.2, 0.1, 0.96]], [0.9, [0.66, 0.75, 0.7, 0.97]], [1, [0.68, 0.8, 0.75, 0.96]]];
const WET_DECK = [[0.5, [0.54, 0.1, 0.05, 0.98]], [0.8, [0.68, 0.55, 0.8, 0.98]], [0.9, [0.74, 0.7, 1, 0.97]], [1, [0.76, 0.75, 1, 0.95]]];
export function cloudLook(clouds = 0, raining = false) {
  const c = Math.min(1, Math.max(0, Number(clouds) || 0)), table = raining && c > 0.5 ? WET_DECK : DRY_DECK;
  const after = table.findIndex(([at]) => at >= c), to = table[Math.max(0, after)], from = table[Math.max(0, after - 1)], k = to[0] > from[0] ? (c - from[0]) / (to[0] - from[0]) : 1;
  return from[1].map((v, i) => v + (to[1][i] - v) * k);
}

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
// A scene whose floor is grass is grass everywhere (fireflies, the season's colour). Not dirt: it is also the guess for
// any outdoor or lit scene with no floor set, and painted every such map's streets and floors green, fireflies over them.
const GRASSY = new Set(['grass']);
// How fast a river runs, by its region's choice (0-1): what the water's look reads as its current. Unset is gentle.
export const riverCurrent = (choice) => ({ swift: 1, slow: 0.2, slower: 0.1 })[choice] ?? 0.4;

/**
 * Where the map's surfaces lie: { water, frozen, hot, grass } polygon lists (flat x, y pairs) from the regions with a
 * floor (movement-feel.mjs regionFloor), `bare` the regions with any other floor, and `whole`: the surface the scene's
 * own floor gives everywhere else ('frozen' for a snowy scene, 'hot' for a sandy one, else null), `grassAll` whether it
 * is grassy. `flows` the rivers ({ polygons, angle, speed }). `regions`: [{ floor, polygons, freezes, flow, current, painted (Animater paints this floor, sparkle and all) }]; a polygon's `holes` (flat x, y pairs each) the holes drawn in it.
 */
export function surfacesOf({ sceneFloor = null, regions = [] } = {}) {
  const out = { water: [], freezes: [], flows: [], icy: [], frozen: [], hot: [], grass: [], tinted: [], bare: [], whole: SURFACE_OF[sceneFloor] ?? null, grassAll: GRASSY.has(sceneFloor) };
  if (out.whole === 'water' || out.whole === 'grass') out.whole = null;
  for (const r of regions ?? []) {
    const kind = SURFACE_OF[r?.floor], polygons = (r?.polygons ?? []).filter((p) => p?.length >= 6);
    if (kind && !(kind === 'frozen' && r.painted)) out[kind].push(...polygons);
    // Ice as a region's own floor (a river's Frozen over): snow only dusts it, so its look still shows.
    if (r?.floor === 'ice') out.icy.push(...polygons);
    // Water that freezes in a hard frost: every water region but one that never does (`freezes` false: a hot spring).
    if (kind === 'water' && r.freezes !== false) out.freezes.push(...polygons);
    // A river: which way it flows (`flow`, radians on the map, the way the water goes) and how fast (`current` 0–1).
    if (kind === 'water' && Number.isFinite(r.flow) && polygons.length) out.flows.push({ polygons, angle: r.flow, speed: Math.min(1, Math.max(0, Number(r.current ?? 0.4))) });
    // Grass the season colours: a region that takes it (region-steps.mjs takesSeason). One that only says what its floor is leaves
    // the map's own paint alone, or it would show as a coloured patch on the map; fireflies still take it for a meadow.
    if (r?.floor === 'grass' && r.seasonal) out.tinted.push(...polygons);
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
uniform float uMovingWater; // moving water (water-engine.mjs) has its own glints
// (uLow: the water widened, in its red for the banks and its green for the low ground. uLampReach: as far as each of the nearest three lights gets, walls and all, a colour each.)
uniform sampler2D uWater, uFrozen, uIndoor, uGrass, uTinted, uBare, uLow, uRoofShown, uSunlit, uTreeShade, uFreeze, uFlow, uCrowns, uLampReach;
uniform vec2 uSize, uWindDir;
uniform vec4 uBird;     // a flock's centre (x, y), heading (radians) and its birds' size (w, 1 a square and a half each; 0 none)
uniform float uTime, uWind, uStrength, uClouds, uGrid, uMode, uFrozenAll, uGrassAll, uWet, uSnow, uMist, uFireflies, uRain, uIce, uLitter;
uniform vec4 uSeason;   // the season's colour over the open ground (rgb) and how strongly (a)
uniform float uMoon;    // moonlight on the open ground at night (0–1: how much of the moon is lit)
uniform vec4 uBow;      // a rainbow: its centre (x, y, scene pixels), radius and strength
uniform vec2 uBowDir;   // the way it faces: away from the sun
uniform vec4 uAmbient;  // the open air's colour at this time of day (rgb), and how strongly (a)
uniform vec4 uVeil;     // the weather's light outdoors (rgb), and how strongly (a): a dark wash in its colour over everything
uniform sampler2D uFxClouds; // FXMaster's clouds as drawn now (their shapes), and where their shadows fall from them
uniform vec2 uFxShift;
uniform float uFxOn;
// The weather on the map (sky-weather.mjs weatherScene): two things falling or blowing (kind, amount, size; their colour),
// fog, the clouds seen from above (their colour, how thick; uCover how much of the sky), where a cloud's shadow falls from
// it, a light over all, aurora, sparks, wisps (rgb, amount), and the odd ones: rays, static, meteors, a swirl (kind, amount).
uniform vec4 uFallA, uFallAColor, uFallB, uFallBColor, uFogW, uCloudSky, uGlow, uAurora, uSparks, uWisps, uOdd;
uniform vec2 uCloudShift;
uniform float uCover, uSwirlAmount, uFallsDown, uFallTime;
uniform vec3 uEye;
uniform float uGloom; // how dark a closed sky makes the outdoors, by day (stormGloom)
uniform float uGloomLift; // how far a flash of lightning lifts it, this moment
uniform sampler2D uSnowRelief; // the shape of the snow lying on the ground (this shader is at the 16 textures a card takes for sure: no more)
uniform float uHasSnowGround;
uniform vec4 uSnowSun;     // toward the sun or moon (x, y), how much of it reaches the ground, how low it is (0.35 high, 2.25 on the horizon)
uniform vec3 uSnowSunColor;
uniform vec4 uSnowLights[4]; // the nearest lights on it: x, y, radius (0 none)
uniform vec3 uSnowLightColor[4];
uniform vec4 uDeck; // the cloud deck's look (cloudLook): how much of the sky, how heavy, how soft its gaps, how dim
// More of the weather (0–1 each): a closed cloud deck, mist lying low, sheets of rain, a hurricane's bands (uSky); freezing
// rain's glaze, frost creeping, heat shimmering, smoke billowing (uSky2).
uniform vec4 uSky, uSky2;
uniform vec3 uColor;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
// Lighter stacks for the weather, which redraws every pixel every frame: three or four layers, rescaled to fbm's range.
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s / 0.875 * 0.96875; }
float fbm4(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s / 0.9375 * 0.96875; }
// Where snow lies in patches: the same pattern as snowPatchAt in this file (a hash without sine, so the GPU and the
// creatures' tracks agree on it).
float patchHash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float patchNoise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f);
  return mix(mix(patchHash(i), patchHash(i + vec2(1, 0)), f.x), mix(patchHash(i + vec2(0, 1)), patchHash(i + vec2(1, 1)), f.x), f.y); }
// Where water stands on wet ground (0-1): small pools at first, spreading and joining the wetter it gets, with an uneven edge.
float puddleAt(vec2 px){
  if (uWet <= 0.05) return 0.0;
  float line = mix(0.68, 0.56, smoothstep(0.1, 1.0, uWet)) - 0.34 * texture2D(uFreeze, vUv).b * smoothstep(0.05, 0.5, uWet);
  return smoothstep(line, line + 0.022, fbm(px / (uGrid * 0.62)) + (noise(px / (uGrid * 0.16)) - 0.5) * 0.03);
}
// Whether the air here is under a ceiling, for what is drawn in the air: rain and flakes, fog, the clouds' wash. An opening in a roof (uFreeze's blue marks one) lets the weather through to the floor, where it shows as what it leaves, wet ground and lying snow; the air of the room stays the room's.
float indoorAir(vec2 uv){ vec4 marks = texture2D(uFreeze, uv); return max(texture2D(uIndoor, uv).a, marks.b); }
// How much lamp and fire light a glossy surface here shows back (the nearest few, in their colours).
vec3 lampsOn(vec2 px){
  vec3 got = vec3(0.0);
  vec4 reach = texture2D(uLampReach, vUv);
  for (int li = 0; li < 3; li++) {
    vec4 lamp = uSnowLights[li];
    if (lamp.z <= 0.0) continue;
    float near = (1.0 - smoothstep(lamp.z * 0.1, lamp.z, length(px - lamp.xy))) * reach[li];
    got += uSnowLightColor[li] * near * near;
  }
  return got;
}
float snowField(vec2 px){
  vec2 p = px / (uGrid * 4.0); float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * patchNoise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return s;
}
float twinkle(vec2 p, float cell, float t, float rate){
  vec2 c = floor(p / cell), f = fract(p / cell) - 0.5;
  float h = hash(c), on = pow(max(0.0, sin(t * rate * (0.6 + h) + h * 40.0)), 10.0);
  return on * (1.0 - smoothstep(0.04, 0.16, length(f - (vec2(hash(c + 3.1), hash(c + 7.7)) - 0.5) * 0.6)));
}
float frostGlint(vec2 p, float cell, float t, float rate){
  vec2 c = floor(p / cell), f = fract(p / cell) - 0.5;
  float h = hash(c), keep = step(0.8, hash(c + 5.9)), bright = hash(c + 1.7), on = pow(max(0.0, sin(t * rate * (0.6 + h) + h * 40.0)), 10.0);
  return keep * on * (0.15 + 0.85 * bright * bright * bright) * (1.0 - smoothstep(0.02, 0.06 + 0.07 * bright, length(f - (vec2(hash(c + 3.1), hash(c + 7.7)) - 0.5) * 0.6)));
}
// The sun caught on wavelet crests: short bright streaks lying across the wind, each flashing for a moment and gone,
// many at once when the wind ruffles the water. 0–1.
// Which way the water's wavelets travel here, and how fast: the wind's, or a river's current (set in main).
vec2 gDir = vec2(1.0, 0.0);
float gPace = 0.3;
float crestGlints(vec2 px, float t){
  vec2 side = vec2(-gDir.y, gDir.x);
  // Crests travel with the wind; the pattern is laid along it (q.x) and across it (q.y).
  vec2 q = vec2(dot(px, gDir) - t * uGrid * gPace, dot(px, side));
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
// How frozen the water is here (0–1): ice creeps in from the banks as it freezes (the blurred water mask is lowest at
// its edges), raggedly, until it covers the whole of it; only water that freezes (uFreeze). At the region's very edge it
// thins out raggedly, so a region drawn a little off the painted banks leaves no ruled line.
float iceOver(vec2 px, float water){
  if (uIce < 0.005 || water < 0.01) return 0.0;
  float banks = texture2D(uLow, vUv).r, deep = smoothstep(0.45, 0.98, banks), ragged = fbm(px / (uGrid * 0.9)) - 0.5;
  float rim = smoothstep(0.32, 0.62, banks + ragged * 0.3);
  return water * rim * texture2D(uFreeze, vUv).a * smoothstep(0.0, 0.1, uIce * 1.3 - deep - ragged * 0.35);
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
// The clouds as seen from above (0–1, thicker higher): billows some five squares across, their edges torn into wisps by
// a second, warping noise, drifting with the wind.
${CLOUD_DECK}
float cloudField(vec2 px, float t){
  vec2 q = px / (uGrid * 5.0) - uWindDir * t * (0.05 + 0.14 * uWind);
  vec2 warp = vec2(noise(q * 1.3 + vec2(1.7, 9.2) + t * 0.01), noise(q * 1.3 + vec2(8.3, 2.8) - t * 0.012)) - 0.5;
  return fbm4(q + warp * 0.9);
}
// Laying one colour over what is drawn so far (premultiplied).
vec4 overP(vec4 p, vec3 c, float a){ a = clamp(a, 0.0, 1.0); return vec4(c * a + p.rgb * (1.0 - a), a + p.a * (1.0 - a)); }
// Light shining on what lies under it (premultiplied with little alpha: it brightens rather than covers).
vec4 addP(vec4 p, vec3 c, float a){ a = clamp(a, 0.0, 1.0); return vec4(p.rgb + c * a, p.a + a * 0.15 * (1.0 - p.a)); }
// One kind of thing falling or blowing across the map, at three depths (the nearer bigger, faster and brighter): rain's
// streaks, snowflakes, hail, ash, petals and leaves tumbling, glowing spores, sand, rising embers, the wind's lines,
// flying debris. Each in cells of the map, one at most per cell, there or not by the amount. f: kind, amount, size.
// Gusts: broad bands of heavier weather sweeping across the map with the wind (0.35 light – 1 heaviest).
float gustAt(vec2 px, float t){
  return 0.35 + 0.65 * smoothstep(0.32, 0.72, fbm3(px / (uGrid * 12.0) - uWindDir * t * (0.12 + 0.3 * uWind) + vec2(0.0, t * 0.02)));
}
// Rain landing: where each drop lands a short train of waves runs out as on a pool (drips.mjs). The slope of the surface (x, y) and how much is moving (z).
vec3 rainRipples(vec2 px, float t, float much, float cell){
  float gs = cell * 0.55, wid = gs * 0.33, waves = 0.0;
  vec2 c0 = floor(px / cell), slope = vec2(0.0);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 c = c0 + vec2(float(i), float(j));
    float h = hash(c + 11.3);
    if (h > much) continue;
    float age = fract(t * (0.9 + 0.6 * h) + h * 17.0);
    vec2 drop = (c + 0.5 + (vec2(hash(c + 1.9), hash(c + 4.7)) - 0.5) * 0.7) * cell;
    vec2 p = px - drop; float d = length(p), off = d - age * cell * 0.9;
    float env = exp(-pow((off + gs * 0.27) / wid, 2.0)) * (1.0 - age) * (1.0 - age);
    waves += env; slope += -env * sin(off * 18.0 / gs) * 0.42 * p / max(d, 0.001);
  }
  return vec3(slope, waves);
}
// From straight overhead (uFallsDown 2), as a camera above the map sees it: everything falling heads for the point under the eye, so it streams in from all round the view toward it, thin and fast at the edges and shrinking to nothing beneath. The layout is around that point: angle one way, the logarithm of the distance the other, so a shape keeps its form as it nears and shrinks with distance, at no more cost than the rest. The wind moves the point, so it all leans with it. uEye: the view's middle (x, y) and how far its corners are.
vec2 aboveOf(vec2 px){ return (px - uEye.xy - uWindDir * uWind * uEye.z * 0.3) / uEye.z; }
vec4 rainAbove(vec4 p, vec2 px, float t, float amount, float size, vec3 col, float over){
  vec2 d = aboveOf(px);
  float r = max(length(d), 0.001), ang = atan(d.y, d.x), dense = amount * gustAt(px, t) * smoothstep(0.02, 0.6, r), clear = smoothstep(0.03, 0.22, r);
  for (int i = 0; i < 3; i++) {
    float depth = float(i), near = 1.0 - depth * 0.3;
    float n = floor(250.0 / (size * (0.7 + 0.5 * near))), k = n / 6.2832;
    vec2 q = vec2(ang * k + depth * 17.0, (log(r) + t * (0.9 + 0.7 * near)) * k);
    vec2 id = floor(vec2(q.x, q.y / 5.0));
    float h = hash(id + depth * 5.1);
    if (h > dense * (0.3 + 0.22 * near)) continue;
    vec2 fl = vec2(fract(q.x) - 0.5, (fract(q.y / 5.0) - 0.5) * 5.0);
    fl.x -= (hash(id + 1.7) - 0.5) * 0.6;
    fl.y -= (hash(id + 4.2) - 0.5) * 2.4;
    float len = (0.6 + 1.1 * hash(id + 8.8)) * (0.6 + 0.6 * near), w = 0.05 + 0.04 * near;
    float along = clamp((len - fl.y) / (2.0 * len), 0.0, 1.0);
    float a = (1.0 - smoothstep(w * 0.35, w, abs(fl.x))) * step(abs(fl.y), len) * (0.15 + 0.85 * along) * (0.22 + 0.34 * near) * (0.6 + 0.4 * hash(id + 2.2)) * clear;
    p = overP(p, mix(col, vec3(1.0), 0.15 * near), a * over);
  }
  // Where it lands: the same ripples as rain on water, fixed to the map, lit on the side facing the light and dark in their troughs.
  vec3 ripple = rainRipples(px, t, min(1.0, amount), uGrid * 0.42 * size);
  if (ripple.z > 0.002) {
    vec3 L = normalize(vec3(-0.55, -0.45, 0.7));
    float shade = (-ripple.x * L.x - ripple.y * L.y) * 1.6;
    p = overP(p, mix(col, vec3(1.0), 0.5), clamp(shade, 0.0, 0.5) * over);
    p = overP(p, vec3(0.0), clamp(-shade * 0.55, 0.0, 0.5) * over);
  }
  return p;
}
vec4 snowAbove(vec4 p, vec2 px, float t, float amount, float size, vec3 col, float over){
  vec2 d = aboveOf(px);
  float r = max(length(d), 0.001), ang = atan(d.y, d.x), dense = min(1.0, amount * 1.1) * (0.5 + 0.5 * gustAt(px, t)) * smoothstep(0.02, 0.55, r), clear = smoothstep(0.02, 0.2, r);
  for (int i = 0; i < 4; i++) {
    float depth = float(i), near = 1.0 - depth * 0.24;
    float n = floor(95.0 / (size * (0.55 + 0.75 * near))), k = n / 6.2832;
    // Their paths wander on slow eddies, the nearest the most.
    float wander = (noise(px / (uGrid * 3.0) + vec2(t * 0.13, depth * 3.1)) - 0.5) * 0.09 * near;
    vec2 q = vec2((ang + wander) * k + depth * 11.0, (log(r) + wander * 0.6 + t * (0.1 + 0.11 * near)) * k + depth * 5.3);
    vec2 id = floor(q), fl = fract(q) - 0.5;
    float h = hash(id + depth * 2.9);
    if (h > dense * (0.3 + 0.2 * near)) continue;
    fl -= (vec2(hash(id + 3.9), hash(id + 7.7)) - 0.5) * 0.6;
    float rad = (0.09 + 0.09 * hash(id + 5.5)) * (0.65 + 0.5 * near), soft = 0.25 + 0.6 * near;
    float a = (1.0 - smoothstep(rad * (1.0 - soft), rad, length(fl))) * (0.45 + 0.3 * near) * (0.8 + 0.2 * hash(id + 1.1)) * clear;
    p = overP(p, col, a * over);
  }
  return p;
}
// Rain seen from above: four depths of thin streaks, each drop's length and brightness its own, brightest at its head
// and fading along its tail (the near ones longer, from the blur of their speed); sheets of heavier rain sweep through;
// drops land in small splash rings that spread and fade.
// The way what falls goes. A scene can ask (Scene configuration: "Rain and snow fall down the map") that it always comes down the map, the wind only leaning it over a little; else the wind takes it wherever it blows.
// (Seen from straight above, whatever has no look of its own from there comes down the map too.)
vec2 fallWay(vec2 way){ return uFallsDown > 0.5 ? normalize(vec2(clamp(way.x, -0.45, 0.45), 1.0)) : normalize(way); }
vec4 rainLayer(vec4 p, vec2 px, float t, float amount, float size, vec3 col, float over){
  if (uFallsDown > 1.5) return rainAbove(p, px, t, amount, size, col, over);
  vec2 dir = fallWay(vec2(0.18, 1.0) + uWindDir * (0.15 + 1.8 * uWind)), side = vec2(-dir.y, dir.x);
  float gust = gustAt(px, t), dense = amount * gust;
  for (int i = 0; i < 4; i++) {
    float depth = float(i), near = 1.0 - depth * 0.24;
    float c = uGrid * size * (0.16 + 0.12 * near);
    // Laid out along the fall (stretched cells), so streaks never line up in rows.
    vec2 q = vec2(dot(px, side), dot(px, dir)) / c;
    q.y -= t * uGrid * (9.0 + 7.0 * near) / c;
    q.x += depth * 17.3;
    vec2 id = floor(vec2(q.x, q.y / 3.0));
    float h = hash(id + depth * 5.1);
    if (h > dense * (0.55 + 0.25 * near)) continue;
    vec2 fl = vec2(fract(q.x) - 0.5, (fract(q.y / 3.0) - 0.5) * 3.0);
    fl.x -= (hash(id + 1.7) - 0.5) * 0.7;
    fl.y -= (hash(id + 4.2) - 0.5) * 1.6;
    float len = (0.45 + 0.9 * hash(id + 8.8)) * (0.6 + 0.6 * near) * (0.35 + 0.65 * min(size, 1.0)), w = (0.035 + 0.03 * near) * (0.6 + 0.4 * min(size, 1.0));
    // The head (fl.y near the bottom end) brightest, the tail fading.
    float along = clamp((fl.y + len) / (2.0 * len), 0.0, 1.0);
    float a = (1.0 - smoothstep(w * 0.4, w, abs(fl.x))) * step(abs(fl.y), len) * (0.25 + 0.75 * along);
    a *= (0.25 + 0.35 * near) * (0.6 + 0.4 * hash(id + 2.2)) * (0.45 + 0.55 * min(size, 1.0));
    p = overP(p, mix(col, vec3(1.0), 0.2 * near), a * over);
  }
  // Splashes: a soft burst of spray where each drop lands, gone in a moment. (On water the drops' ripples do the rest.)
  float sc = uGrid * 0.45;
  vec2 sq = px / sc, sid = floor(sq), sf = fract(sq) - 0.5;
  float sh = hash(sid + 9.1), life = fract(t * 2.2 + sh * 7.0);
  if (sh < dense * 0.7 * min(1.0, size * size)) {
    vec2 at = (vec2(hash(sid + 3.3), hash(sid + 6.6)) - 0.5) * 0.6;
    float r = length(sf - at), spray = exp(-pow(r / (0.025 + life * 0.05), 2.0)) * (1.0 - life) * (1.0 - life) * 0.22;
    p = overP(p, mix(col, vec3(1.0), 0.4), spray * over);
  }
  return p;
}
// Snow seen from above: four depths of flakes, each its own size, drifting on slow eddies rather than in lines, the near
// ones big and soft (out of focus), the far ones small and crisp; flakes smear into streaks in a hard wind; gusts thicken.
vec4 snowLayer(vec4 p, vec2 px, float t, float amount, float size, vec3 col, float over){
  if (uFallsDown > 1.5) return snowAbove(p, px, t, amount, size, col, over);
  vec2 dir = fallWay(vec2(0.1, 1.0) * (1.0 - uWind) + uWindDir * (0.3 + 2.0 * uWind)), side = vec2(-dir.y, dir.x);
  float gust = gustAt(px, t), dense = min(1.0, amount * 1.1) * (0.5 + 0.5 * gust), smear = 1.0 + 3.5 * uWind * uWind;
  for (int i = 0; i < 4; i++) {
    float depth = float(i), near = 1.0 - depth * 0.24;
    float c = uGrid * size * (0.22 + 0.2 * near);
    // Eddies: the flakes' paths bend with a slow, wandering drift.
    vec2 eddy = vec2(noise(px / (uGrid * 3.0) + vec2(t * 0.15, depth)), noise(px / (uGrid * 3.0) + vec2(depth, t * 0.13))) - 0.5;
    vec2 q = (px + eddy * uGrid * 0.8) / c - dir * t * uGrid * (0.9 + 2.8 * uWind * uWind) * (0.5 + 0.5 * near) / c + depth * vec2(11.7, 5.3);
    vec2 id = floor(q), fl = fract(q) - 0.5;
    float h = hash(id + depth * 2.9);
    if (h > dense * (0.3 + 0.2 * near)) continue;
    fl -= (vec2(hash(id + 1.1), hash(id + 3.9)) - 0.5) * 0.6;
    fl += side * 0.15 * sin(t * (1.0 + h) + h * 30.0);
    float r = (0.06 + 0.06 * hash(id + 5.5)) * (0.75 + 0.5 * near);
    float d = length(vec2(dot(fl, dir) / smear, dot(fl, side) * (1.0 + 0.7 * uWind)));
    // Near flakes soft-edged and faint at the rim (out of focus); far ones crisp.
    float soft = 0.25 + 0.6 * near;
    float a = (1.0 - smoothstep(r * (1.0 - soft), r, d)) * (0.5 + 0.2 * near) * (0.8 + 0.2 * hash(id + 7.7));
    p = overP(p, col, a * over);
  }
  return p;
}
// Sand and dust: sheets of it streaming with the wind, torn and uneven, thick in the gusts, and fine grains racing
// through them in streaks; its colour shifting where it lies thick.
vec4 sandLayer(vec4 p, vec2 px, float t, float amount, float size, vec3 col, float over){
  vec2 dir = normalize(uWindDir + vec2(0.0, 0.05)), side = vec2(-dir.y, dir.x);
  float along = dot(px, dir), across = dot(px, side), gust = gustAt(px, t);
  float speed = (2.5 + 5.0 * uWind);
  // Three layers of billows, the near ones faster, each torn by a warp that rolls with them; lit on their windward
  // face, shadowed in their lee, so they have body.
  for (int i = 0; i < 2; i++) {
    float depth = float(i), near = 1.0 - depth * 0.45, scale = 4.5 - depth * 1.8;
    vec2 q = vec2(along / (uGrid * scale) - t * speed * (0.18 + 0.12 * near), across / (uGrid * scale * 0.45)) + depth * vec2(5.1, 2.7);
    vec2 warp = vec2(noise(q * 0.8 + vec2(t * 0.15, 0.0)), noise(q * 0.8 + vec2(3.7, -t * 0.12))) - 0.5;
    float body = fbm4(q + warp * 1.8), lee = body - (noise(q * 2.0 + warp * 3.6 + vec2(0.25, 0.0)) - 0.5) * 0.12;
    float billow = smoothstep(0.38, 0.78, body) * (0.55 + 0.45 * gust);
    vec3 tone = col * (0.72 + 0.5 * clamp((body - lee) * 6.0 + 0.5, 0.0, 1.0));
    p = overP(p, tone, billow * (0.4 + 0.12 * near) * amount * over);
  }
  // Fine grain racing through: specks flickering past, too quick to be lines.
  vec2 g = vec2(along - t * uGrid * (9.0 + 9.0 * uWind), across) / (uGrid * 0.1 * size), gc = floor(g), gf = fract(g) - 0.5;
  float grain = step(0.985 - 0.02 * amount * gust, hash(gc + floor(t * 20.0))) * (1.0 - smoothstep(0.08, 0.32, length(gf * vec2(0.6, 1.4))));
  p = overP(p, col * 1.15, grain * 0.3 * amount * over);
  return p;
}
// Embers: sparks lifting off a fire on the hot air, each flaring and fading, with a short glowing trail and a soft bloom.
vec4 emberLayer(vec4 p, vec2 px, float t, float amount, float size, vec3 col, float over){
  vec2 dir = normalize(vec2(0.0, -1.0) + uWindDir * (0.6 + uWind)), side = vec2(-dir.y, dir.x);
  for (int i = 0; i < 3; i++) {
    float depth = float(i), near = 1.0 - depth * 0.3, c = uGrid * size * (0.5 + 0.3 * near);
    vec2 eddy = vec2(noise(px / (uGrid * 2.0) + vec2(t * 0.4, depth)), noise(px / (uGrid * 2.0) + vec2(depth, t * 0.35))) - 0.5;
    vec2 q = (px + eddy * uGrid * 0.6) / c - dir * t * uGrid * (0.7 + 0.6 * uWind) / c + depth * vec2(7.7, 3.1);
    vec2 id = floor(q), fl = fract(q) - 0.5;
    float h = hash(id + depth * 4.4);
    if (h > amount * 0.45) continue;
    fl -= (vec2(hash(id + 1.9), hash(id + 6.1)) - 0.5) * 0.6;
    fl += side * 0.18 * sin(t * (1.4 + h) + h * 20.0);
    // Flickering as it burns, now and then flaring, dying back.
    float flick = 0.55 + 0.45 * noise(vec2(t * (6.0 + 6.0 * h), h * 50.0)), flare = smoothstep(0.85, 1.0, noise(vec2(t * 0.7, h * 31.0)));
    float d = length(fl), heat = flick + flare;
    float core = exp(-d * d / (0.0006 + 0.0006 * near));
    float glow = exp(-d * d / (0.01 + 0.01 * flare)) * 0.4;
    vec3 tone = mix(col, vec3(1.0, 0.9, 0.55), clamp(core * heat, 0.0, 1.0));
    p = addP(p, tone, (core * 1.2 + glow) * heat * (0.6 + 0.5 * near) * over);
  }
  return p;
}
// Spores and motes: soft glowing specks wandering on the air, each with a faint halo, swelling and dimming slowly.
vec4 sporeLayer(vec4 p, vec2 px, float t, float amount, float size, vec3 col, float over){
  for (int i = 0; i < 3; i++) {
    float depth = float(i), near = 1.0 - depth * 0.3, c = uGrid * size * (0.55 + 0.35 * near);
    vec2 wander = vec2(noise(px / (uGrid * 2.5) + vec2(t * 0.12, depth * 3.0)), noise(px / (uGrid * 2.5) + vec2(depth * 3.0, t * 0.1))) - 0.5;
    vec2 q = (px + wander * uGrid * 1.2) / c - uWindDir * t * uGrid * (0.1 + 0.3 * uWind) / c + depth * vec2(5.5, 9.9);
    vec2 id = floor(q), fl = fract(q) - 0.5;
    float h = hash(id + depth * 2.2);
    if (h > amount * 0.5) continue;
    fl -= (vec2(hash(id + 3.4), hash(id + 8.2)) - 0.5) * 0.6;
    float pulse = 0.55 + 0.45 * sin(t * (0.8 + h) + h * 30.0), d = length(fl);
    float core = 1.0 - smoothstep(0.0, 0.05 + 0.03 * near, d), halo = (1.0 - smoothstep(0.0, 0.22, d)) * 0.3;
    p = overP(p, mix(col, vec3(1.0), core * 0.4), max(core, halo) * pulse * (0.5 + 0.5 * near) * over);
  }
  return p;
}
// Ash: grey flakes drifting down slowly, fluttering and turning as they fall, some catching the light.
vec4 ashLayer(vec4 p, vec2 px, float t, float amount, float size, vec3 col, float over){
  vec2 dir = fallWay(vec2(0.15, 1.0) + uWindDir * (0.3 + uWind)), side = vec2(-dir.y, dir.x);
  for (int i = 0; i < 3; i++) {
    float depth = float(i), near = 1.0 - depth * 0.3, c = uGrid * size * (0.35 + 0.25 * near);
    vec2 q = px / c - dir * t * uGrid * (0.35 + 0.8 * uWind) / c + depth * vec2(4.2, 8.8);
    vec2 id = floor(q), fl = fract(q) - 0.5;
    float h = hash(id + depth * 6.3);
    if (h > amount * 0.55) continue;
    fl -= (vec2(hash(id + 2.4), hash(id + 7.3)) - 0.5) * 0.6;
    fl += side * 0.2 * sin(t * (1.2 + h) + h * 25.0);
    float turn = t * (1.0 + 2.0 * h) + h * 6.28, flip = abs(cos(t * (1.5 + h) + h * 9.0));
    vec2 r = vec2(cos(turn) * fl.x - sin(turn) * fl.y, sin(turn) * fl.x + cos(turn) * fl.y);
    float a = 1.0 - smoothstep(0.8, 1.0, length(r / vec2(0.07, 0.035 + 0.035 * flip)));
    p = overP(p, col * (0.8 + 0.5 * flip), a * (0.55 + 0.35 * near) * over);
  }
  return p;
}
// The wind made visible: long, thin lines curving with the air, growing and fading as each gust passes.
vec4 gustLayer(vec4 p, vec2 px, float t, float amount, float size, vec3 col, float over){
  vec2 side = vec2(-uWindDir.y, uWindDir.x);
  for (int i = 0; i < 2; i++) {
    float depth = float(i);
    float bend = (noise(px / (uGrid * 6.0) + vec2(t * 0.05, depth)) - 0.5) * uGrid * 1.5;
    vec2 q = vec2(dot(px, uWindDir) / (uGrid * 6.0) - t * (1.2 + 1.5 * uWind), (dot(px, side) + bend) / (uGrid * 0.6)) + depth * vec2(3.3, 1.7);
    vec2 id = floor(q), fl = fract(q) - 0.5;
    float h = hash(id + depth * 5.5);
    if (h > amount * 0.35) continue;
    fl.y -= (hash(id + 1.4) - 0.5) * 0.6;
    float life = sin(clamp(fl.x + 0.5, 0.0, 1.0) * 3.1416);
    float a = (1.0 - smoothstep(0.01, 0.035, abs(fl.y))) * life * 0.3;
    p = overP(p, col, a * over);
  }
  return p;
}
vec4 fallLayer(vec4 p, vec2 px, float t, vec4 f, vec3 col, float over){
  float kind = f.x, amount = f.y, size = f.z;
  if (amount < 0.01 || kind < 0.5) return p;
  if (kind < 1.5) return rainLayer(p, px, t, amount, size, col, over);
  if (kind < 2.5) return snowLayer(p, px, t, amount, size, col, over);
  if (kind > 3.5 && kind < 4.5) return ashLayer(p, px, t, amount, size, col, over);
  if (kind > 6.5 && kind < 7.5) return sporeLayer(p, px, t, amount, size, col, over);
  if (kind > 7.5 && kind < 8.5) return sandLayer(p, px, t, amount, size, col, over);
  if (kind > 8.5 && kind < 9.5) return p;
  if (kind > 9.5 && kind < 10.5) return gustLayer(p, px, t, amount, size, col, over);
  vec2 lean = fallWay(vec2(0.22, 1.0) + uWindDir * (0.2 + 1.6 * uWind));
  for (int i = 0; i < 3; i++) {
    float depth = float(i), near = 1.0 - depth * 0.28;
    // The kind's cell (squares), speed (squares a second), the way it moves, and how often a cell holds one.
    float cell = 0.3, speed = 9.0, density = 0.55; vec2 dir = lean;
    if (kind < 1.5) { cell = 0.32; speed = 11.0; density = 0.6; }
    else if (kind < 2.5) { cell = 0.36; speed = 1.1 + 3.0 * uWind * uWind; density = 0.55 + 0.35 * amount; }
    else if (kind < 3.5) { cell = 0.4; speed = 8.0; density = 0.5; }
    else if (kind < 4.5) { cell = 0.45; speed = 0.5 + uWind; density = 0.5; }
    else if (kind < 6.5) { cell = 0.9; speed = 0.7 + 1.2 * uWind; density = 0.35; dir = normalize(vec2(0.3, 0.6) + uWindDir * (0.4 + uWind)); }
    else if (kind < 7.5) { cell = 0.7; speed = 0.12 + 0.3 * uWind; density = 0.45; dir = normalize(uWindDir + vec2(0.0, 0.2)); }
    else if (kind < 8.5) { cell = 0.25; speed = 14.0; density = 0.7; dir = normalize(uWindDir + vec2(0.0, 0.05)); }
    else if (kind < 9.5) { cell = 0.6; speed = 0.6 + 0.6 * uWind; density = 0.4; dir = normalize(vec2(0.0, -1.0) + uWindDir * (0.5 + uWind)); }
    else if (kind < 10.5) { cell = 2.4; speed = 7.0 + 6.0 * uWind; density = 0.18; dir = uWindDir; }
    else { cell = 0.5; speed = 4.0 + 4.0 * uWind; density = 0.3; dir = normalize(uWindDir + vec2(0.2, 0.1)); }
    float c = uGrid * cell * size * (0.75 + 0.35 * near);
    vec2 q = px / c - dir * t * speed * uGrid * (0.6 + 0.4 * near) / c + depth * vec2(13.1, 7.7);
    vec2 id = floor(q), fl = fract(q) - 0.5;
    float h = hash(id + depth * 3.3);
    if (h > amount * density) continue;
    fl -= (vec2(hash(id + 1.3), hash(id + 2.7)) - 0.5) * 0.6;
    vec2 side = vec2(-dir.y, dir.x);
    float along = dot(fl, dir), across = dot(fl, side), a = 0.0;
    if (kind < 1.5) a = (1.0 - smoothstep(0.012, 0.03, abs(across))) * (1.0 - smoothstep(0.25, 0.42, abs(along))) * 0.55;
    else if (kind < 2.5) { vec2 w = fl - side * 0.12 * sin(t * 1.7 + h * 30.0); float smear = 1.0 + 3.0 * uWind * uWind; a = (1.0 - smoothstep(0.05, 0.11, length(vec2(dot(w, dir) / smear, dot(w, side))))) * 0.9; }
    else if (kind < 3.5) a = (1.0 - smoothstep(0.03, 0.07, length(fl))) * 0.95;
    else if (kind < 4.5) { vec2 w = fl - side * 0.2 * sin(t * 1.1 + h * 20.0); a = (1.0 - smoothstep(0.04, 0.09, length(w * vec2(1.0, 1.6)))) * 0.75; }
    else if (kind < 6.5) {
      float turn = t * (1.5 + 2.0 * h) + h * 6.28, ct = cos(turn), st = sin(turn);
      vec2 r = vec2(ct * fl.x - st * fl.y, st * fl.x + ct * fl.y);
      a = (1.0 - smoothstep(0.8, 1.0, length(r / vec2(0.1, kind < 5.5 ? 0.06 : 0.05)))) * 0.9;
    }
    else if (kind < 7.5) a = (1.0 - smoothstep(0.0, 0.12, length(fl))) * (0.55 + 0.45 * sin(t * 2.0 + h * 20.0));
    else if (kind < 8.5) a = (1.0 - smoothstep(0.01, 0.03, abs(across))) * (1.0 - smoothstep(0.2, 0.48, abs(along))) * 0.7;
    else if (kind < 9.5) a = (1.0 - smoothstep(0.0, 0.07, length(fl))) * (0.5 + 0.5 * sin(t * 9.0 + h * 40.0));
    else if (kind < 10.5) a = (1.0 - smoothstep(0.004, 0.012, abs(across))) * (1.0 - smoothstep(0.1, 0.48, abs(along))) * 0.22 * smoothstep(0.0, 0.5, sin(t * 0.8 + h * 20.0));
    else { float turn = t * 6.0 + h * 6.28; vec2 r = vec2(cos(turn) * fl.x - sin(turn) * fl.y, sin(turn) * fl.x + cos(turn) * fl.y); a = (1.0 - smoothstep(0.03, 0.06, max(abs(r.x), abs(r.y) * 1.6))) * 0.9; }
    p = overP(p, col * (0.85 + 0.15 * near), a * (0.55 + 0.45 * near) * over);
  }
  return p;
}
void main(){
  vec2 px = vUv * uSize;
  float outside = 1.0 - texture2D(uIndoor, vUv).a, t = uTime;
  float water = texture2D(uWater, vUv).a;
  // Where grass grows: the fireflies' meadows.
  float meadow = max(texture2D(uGrass, vUv).a, uGrassAll * (1.0 - texture2D(uBare, vUv).a)) * (1.0 - water) * outside;
  if (uMode > 5.5) {
    // The colour of the open air at this time of day, multiplied into all below it, roofs too; a room seen into (its roof faded) keeps its own.
    float roofed = texture2D(uIndoor, vUv).a;
    gl_FragColor = vec4(mix(vec3(1.0), uAmbient.rgb, uAmbient.a * (1.0 - roofed + roofed * texture2D(uRoofShown, vUv).a)), 1.0);
    return;
  }
  if (uMode > 4.5) {
    // The weather's own light (uMode 5, drawn over the night's darkness, added): divine rays and the motes in them,
    // aurora, sparks along their currents, embers, meteors; a room seen into keeps its own light.
    float inside = indoorAir(vUv), roof = texture2D(uRoofShown, vUv).a, over = (1.0 - inside) + inside * roof;
    vec4 pg = vec4(0.0);
    if (uOdd.x > 0.005) {
      vec2 rd = normalize(vec2(0.86, 0.5)), rs = vec2(-rd.y, rd.x);
      float across = dot(px, rs) / (uGrid * 2.2) + fbm(vec2(dot(px, rd) / (uGrid * 12.0), t * 0.03)) * 2.5;
      float beam = pow(0.5 + 0.5 * sin(across * 3.1416), 6.0) * (0.6 + 0.4 * sin(t * 0.3 + across));
      pg = addP(pg, uGlow.rgb, beam * uOdd.x * 0.4 * over);
      pg = addP(pg, vec3(1.0, 0.95, 0.75), twinkle(px + rd * t * uGrid * 0.15, uGrid * 0.35, t, 1.2) * beam * uOdd.x * 1.2 * over);
    }
    if (uAurora.a > 0.005) {
      for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float curve = (fbm(vec2(px.x / (uGrid * 14.0) + fk * 3.7, t * 0.02 + fk)) - 0.5) * uGrid * 10.0 + (0.3 + 0.4 * fk) * uSize.y;
        float d = (px.y - curve) / (uGrid * (1.2 + 0.6 * fk));
        float curtain = exp(-d * d * 1.6) * (1.0 - smoothstep(-0.2, 1.4, d));
        // Soft rays through the curtain, wider and gentler than a comb, drifting along it.
        float rays = 0.72 + 0.28 * mix(noise(vec2(px.x / (uGrid * 0.7) + t * 0.35, fk * 7.0)), noise(vec2(px.x / (uGrid * 1.6) - t * 0.2, fk * 3.0)), 0.5);
        float ripple = 0.7 + 0.3 * sin(px.x / (uGrid * 3.0) - t * 0.8 + fk * 2.0);
        vec3 hue = mix(uAurora.rgb, vec3(0.7, 0.35, 1.0), smoothstep(0.4, 1.5, abs(d)) * 0.6);
        pg = addP(pg, hue, curtain * rays * ripple * uAurora.a * 0.5 * over);
      }
    }
    if (uSparks.a > 0.005) {
      vec2 flowAt = vec2(noise(px / (uGrid * 5.0) + t * 0.05), noise(px / (uGrid * 5.0) + 8.1 - t * 0.04)) - 0.5;
      vec2 fdir = normalize(uWindDir + flowAt * 2.5);
      float thread = 1.0 - smoothstep(0.0, 0.06, abs(fract(dot(px, vec2(-fdir.y, fdir.x)) / (uGrid * 2.5) + fbm(px / (uGrid * 8.0)) * 2.0) - 0.5));
      float streaming = twinkle(px - fdir * t * uGrid * 1.5, uGrid * 0.4, t, 2.0);
      pg = addP(pg, uSparks.rgb, thread * 0.15 * uSparks.a * over);
      pg = addP(pg, mix(uSparks.rgb, vec3(1.0), 0.5), (streaming * thread * 1.5 + twinkle(px, uGrid * 0.7, t, 3.0) * 0.5) * uSparks.a * over);
    }
    if (uFallA.x > 8.5 && uFallA.x < 9.5) pg = emberLayer(pg, px, uFallTime, uFallA.y, uFallA.z, uFallAColor.rgb, over);
    if (uFallB.x > 8.5 && uFallB.x < 9.5) pg = emberLayer(pg, px, uFallTime, uFallB.y, uFallB.z, uFallBColor.rgb, over);
    if (uOdd.z > 0.005) {
      vec2 md = normalize(vec2(1.0, 0.55)), mside = vec2(-md.y, md.x);
      // Five at a time, each streaking across the map's middle in about a second, then gone a while.
      float span = max(uSize.x, uSize.y);
      for (int k = 0; k < 6; k++) {
        float fk = float(k), per = 2.4 + fk * 0.7, ph = t / per + fk * 0.37, n = floor(ph), u = fract(ph) / 0.3;
        if (u > 1.0 || hash(vec2(n, fk)) > uOdd.z) continue;
        vec2 start = vec2(0.1 + 0.6 * hash(vec2(n, fk + 3.0)), 0.05 + 0.5 * hash(vec2(fk + 5.0, n))) * uSize;
        vec2 headAt = start + md * u * span * 0.55;
        vec2 d = px - headAt;
        float along = dot(d, md), across = dot(d, mside);
        float tail = span * 0.18 * min(1.0, u * 3.0);
        float back = clamp(-along / max(1.0, tail), 0.0, 1.0);
        // A fine bright line (its width a gaussian, so it has no hard edge), fading along its length.
        float w = uGrid * (0.03 + 0.03 * (1.0 - back));
        float trail = exp(-across * across / (w * w)) * step(along, 0.0) * step(back, 0.999) * pow(1.0 - back, 2.0);
        float halo = exp(-across * across / (w * w * 16.0)) * step(along, 0.0) * pow(1.0 - back, 3.0) * 0.25;
        // The head: a small white-blue point with a soft glow; sparks shed behind it, winking out.
        float hd = length(d), hot = exp(-hd * hd / (uGrid * uGrid * 0.004)), bloom = exp(-hd * hd / (uGrid * uGrid * 0.12)) * 0.35;
        float sparks = twinkle(vec2(along, across * 4.0), uGrid * 0.12, t, 9.0) * step(along, 0.0) * step(back, 0.5) * exp(-across * across / (w * w * 9.0));
        float fade = sin(min(u, 1.0) * 3.1416);
        vec3 burn = mix(vec3(1.0, 0.4, 0.2), vec3(1.0, 0.86, 0.55), pow(1.0 - back, 2.0));
        pg = addP(pg, burn, (trail + halo + sparks * 0.8) * fade * over);
        pg = addP(pg, vec3(0.9, 0.95, 1.0), (hot * 1.2 + bloom) * fade * over);
      }
    }
    gl_FragColor = vec4(pg.rgb, 0.0);
    return;
  }
  if (uMode > 3.5) {
    // The weather's light over the open ground and the roofs as drawn now; a room seen into (its roof faded) keeps its own.
    float inside = indoorAir(vUv), roof = texture2D(uRoofShown, vUv).a;
    // (A dark wash in the light's colour, not a multiply: Foundry's canvas layer draws its children blended normally.)
    float over = (1.0 - inside) + inside * roof, s = uVeil.a * 0.5 * over;
    // Fog and mist also come in where the air does (uFreeze's green).
    float airOver = uFogW.a > 0.005 || uSky.y > 0.005 ? max(over, texture2D(uFreeze, vUv).g) : over;
    if (airOver < 0.01) { gl_FragColor = vec4(0.0); return; }
    // The clouds show in what they do to the land, over the ground, the roofs and the trees alike: firm shadows and warm
    // sunlit patches sliding with the wind (a little even on a still day: the wind aloft); a closed sky is dim and cool, with slow lighter patches.
    float cloud = 0.0, deckDark = 0.0; vec3 deckAdd = vec3(0.0);
    // (The sun between the clouds is the clear sky's: uStrength is already dimmed by the cover.)
    float sun = min(1.0, uStrength / max(0.1, 1.0 - uClouds));
    if (uFxOn > 0.5 && uStrength > 0.005) {
      // FXMaster's clouds drawn over the map: each casts its own shadow, thrown away from the sun.
      // (Their puffs are soft and overlap: the shadow takes their denser middles, with a firm edge.)
      cloud = smoothstep(0.12, 0.3, texture2D(uFxClouds, vUv - uFxShift).a) * 0.5 * sun * over;
    } else if (uClouds > 0.05 && uStrength > 0.005) {
      // (A cloud's shadow lies uCloudShift away from it: the cloud drawn above it, where the sun throws it.)
      float edge = mix(0.74, 0.3, uDeck.x), d = cloudDeck(px - uCloudShift, t, uWindDir, uWind, uGrid);
      vec3 lit = vec3(1.1, 1.06, 0.97) * (1.0 - 0.38 * uDeck.y), under = mix(vec3(0.56, 0.6, 0.68), vec3(0.47, 0.5, 0.57), min(1.0, uDeck.y * 0.5 + smoothstep(edge, edge + 0.24, d) * (0.45 + 0.5 * uDeck.y)));
      // What it does to the light, as a wash: normal blending only, so how much it darkens, and what light it adds back.
      // (Never most of the day's light: broken cloud only passing shade, a closed sky dull but plainly day.)
      vec3 light = mix(vec3(1.0), mix(lit, under, deckShade(d, uDeck)) * uDeck.w, sun * over * (0.45 + 0.35 * uDeck.y));
      deckDark = 1.0 - min(1.0, min(light.r, min(light.g, light.b)));
      deckAdd = max(light - (1.0 - deckDark), vec3(0.0)) * 0.38;
    }
    vec3 col = uVeil.rgb * 0.28 * s * (1.0 - cloud) + vec3(0.03, 0.04, 0.06) * cloud;
    vec4 pw = vec4(col, 1.0 - (1.0 - s) * (1.0 - cloud));
    pw = vec4(deckAdd + pw.rgb * (1.0 - deckDark), deckDark + pw.a * (1.0 - deckDark));
    // A closed sky makes a dull dusk of the day: a cool, dark wash, only as much more as the clouds and the weather's light have not done already, so uGloom is how dark it all comes to. All of it draws back around each lamp and fire, as far as its light gets past the walls, so they show up against it.
    if (uGloom > 0.005) {
      float need = uGloom * over;
      if (need > pw.a) pw = overP(pw, vec3(0.035, 0.045, 0.07), (need - pw.a) / (1.0 - pw.a));
      pw *= (1.0 - min(1.0, dot(lampsOn(px), vec3(0.6)))) * (1.0 - uGloomLift);
    }
    // Clouds of their own colour seen from above, for the weathers that ask for them (ash, smoke); drifting with the wind,
    // thinner once the sky has closed over, so the map stays readable under it.
    if (uCloudSky.a > 0.005 && uCover > 0.05) {
      // Lit from the sun's side: brighter where the cloud thins toward the sun, grey-blue where it deepens away from it.
      float edge = 1.0 - uCover, d = cloudField(px, t);
      vec2 toSun = -normalize(uCloudShift + vec2(1e-3));
      vec2 lq = (px + toSun * uGrid * 0.35) / (uGrid * 5.0) - uWindDir * t * (0.05 + 0.14 * uWind);
      float lit = clamp(0.5 + (d - fbm3(lq)) * 4.0, 0.0, 1.0);
      float c = smoothstep(edge - 0.04, edge + 0.22, d) * (1.0 - 0.6 * smoothstep(0.75, 1.0, uCover));
      vec3 tone = mix(vec3(0.58, 0.62, 0.7), vec3(1.0), 0.35 + 0.65 * lit) * uCloudSky.rgb * (0.6 + 0.4 * sun);
      pw = overP(pw, tone, c * 0.26 * uCloudSky.a * over);
    }
    // Fog drifting with the wind, in its colour: thicker in places.
    if (uFogW.a > 0.005) {
      // Two banks at different heights drifting at their own pace, warped into wisps; deeper in the hollows and over water.
      // Laid out along the wind: it runs faster the harder it blows, and draws out into long streaks.
      vec2 across = vec2(-uWindDir.y, uWindDir.x);
      vec2 q = vec2(dot(px, uWindDir) / (uGrid * 7.0 * (1.0 + 1.6 * uWind)) - t * (0.02 + 0.13 * uWind), dot(px, across) / (uGrid * 7.0));
      vec2 warp = vec2(noise(q * 2.0 + t * 0.03), noise(q * 2.0 + 5.2 - t * 0.025)) - 0.5;
      float lowBank = fbm4(q + warp * 0.8), highBank = fbm3(q * 0.6 + vec2(3.1 - t * (0.02 + 0.05 * uWind), 7.4));
      float hollow = 0.75 + 0.5 * texture2D(uLow, vUv).g;
      float n = 0.6 * smoothstep(0.25, 0.75, lowBank) + 0.4 * smoothstep(0.3, 0.7, highBank);
      pw = overP(pw, uFogW.rgb, uFogW.a * (0.3 + 0.7 * n) * hollow * 0.8 * airOver);
    }
    // Mist: thin white veils lying low over the ground, longer than they are wide, drifting slowly, gathering in the
    // hollows and over water; the ground shows through.
    if (uSky.y > 0.005) {
      vec2 side = vec2(-uWindDir.y, uWindDir.x);
      vec2 q = vec2(dot(px, uWindDir) / (uGrid * 7.0 * (1.0 + 1.3 * uWind)) - t * (0.02 + 0.15 * uWind), dot(px, side) / (uGrid * 5.0));
      vec2 warp = vec2(noise(q * 1.3 + t * 0.02), noise(q * 1.3 + 4.4)) - 0.5;
      float veil = smoothstep(0.3, 0.7, fbm4(q + warp * 0.9)), wisp = smoothstep(0.5, 0.78, fbm3(q * 2.3 + warp + 9.0));
      float hollow = 0.8 + 0.7 * texture2D(uLow, vUv).g;
      pw = overP(pw, vec3(0.94, 0.96, 0.98), (0.08 + veil * 0.26 + wisp * 0.1) * hollow * uSky.y * airOver);
    }
    pw = fallLayer(pw, px, uFallTime, uFallA, uFallAColor.rgb, over);
    pw = fallLayer(pw, px, uFallTime, uFallB, uFallBColor.rgb, over);
    // Sheets of rain: broad grey curtains sweeping across with the wind, the rain heaviest in them; water standing on the
    // ground, glossy, where it pours.
    if (uSky.z > 0.005) {
      vec2 side = vec2(-uWindDir.y, uWindDir.x);
      vec2 q = vec2(dot(px, uWindDir) / (uGrid * 5.0) - t * (0.6 + 1.2 * uWind), dot(px, side) / (uGrid * 14.0));
      float sheet = smoothstep(0.45, 0.8, fbm3(q + vec2(noise(q * 0.5 + t * 0.1), 0.0)));
      pw = overP(pw, vec3(0.5, 0.55, 0.62), sheet * 0.3 * uSky.z * over);
      float pool = smoothstep(0.55, 0.75, fbm3(px / (uGrid * 2.5) + 3.3)) * outside * (1.0 - water);
      pw = overP(pw, vec3(0.36, 0.42, 0.5), pool * 0.18 * uSky.z * over);
    }
    // A hurricane from above: its calm eye on the map, drifting with the wind, a thick wall of cloud round it and great arms spiralling out, turning.
    if (uSky.w > 0.005) {
      vec2 eye = uSize * 0.5 + vec2(sin(t * 0.017), cos(t * 0.013)) * uSize * 0.14 + uWindDir * sin(t * 0.009) * uGrid * 3.0, d = px - eye;
      float size = min(uSize.x, uSize.y), r = length(d) / size, ang = atan(d.y, d.x);
      // The cloud itself wound round the eye, tighter toward it: a turning pattern, soft and torn, with broad arms only leaning on it.
      float turn = log(r + 0.06) * 2.8 + t * (0.16 + 0.3 * uWind), cs = cos(turn), sn = sin(turn);
      vec2 q = mat2(cs, -sn, sn, cs) * d / size;
      float cloud = fbm4(q * 3.4 + 7.0) * 0.68 + fbm3(q * 10.0 + 3.0) * 0.32, arm = 0.5 + 0.5 * sin(ang * 2.0 - log(r + 0.05) * 5.0 + t * (0.16 + 0.3 * uWind));
      float calm = smoothstep(0.035, 0.085, r + (cloud - 0.5) * 0.04), wall = calm * (1.0 - smoothstep(0.08, 0.2, r));
      float dense = max(smoothstep(0.42, 0.72, cloud * 0.78 + arm * 0.3), wall) * calm;
      // Dark storm cloud, lighter only where it is thickest and the light catches it.
      pw = overP(pw, mix(vec3(0.17, 0.19, 0.22), vec3(0.56, 0.59, 0.63), smoothstep(0.42, 0.72, cloud)), dense * (0.5 + 0.18 * wall) * uSky.w * over);
    }
    // Freezing rain's glaze: everything outdoors coated in clear ice, glossy and pale, catching hard points of light.
    if (uSky2.x > 0.005) {
      float sheen = 0.5 + 0.5 * fbm3(px / (uGrid * 1.5));
      pw = overP(pw, vec3(0.82, 0.9, 1.0), (0.12 + 0.12 * sheen) * uSky2.x * over);
      float glint = twinkle(px, uGrid * 0.22, t, 2.5) * smoothstep(0.55, 0.85, sheen);
      pw = overP(pw, vec3(1.0), glint * 0.9 * uSky2.x * over);
    }
    // Frost creeping in from the map's edges: feathery white veins branching across the ground, thickening as it comes.
    if (uSky2.y > 0.005) {
      vec2 e = min(px, uSize - px) / uGrid;
      float reach = min(e.x, e.y), creep = 1.0 - smoothstep(2.0, 9.0, reach + (fbm3(px / (uGrid * 3.0)) - 0.5) * 6.0);
      float veins = 0.0, amp = 1.0, sc = 1.2;
      for (int k = 0; k < 3; k++) { veins += amp * (1.0 - smoothstep(0.0, 0.022, abs(noise(px / (uGrid * sc) + float(k) * 7.0) - 0.5))); amp *= 0.6; sc *= 0.45; }
      float rime = clamp(veins * 0.3, 0.0, 1.0) * creep + creep * (0.12 + 0.5 * smoothstep(0.35, 0.7, fbm3(px / (uGrid * 0.4))));
      pw = overP(pw, vec3(0.86, 0.94, 1.0), rime * 0.6 * uSky2.y * over);
      pw = overP(pw, vec3(1.0), twinkle(px, uGrid * 0.3, t, 1.5) * creep * 0.7 * uSky2.y * over);
    }
    // Heat: a pale, bleached haze in slow drifting banks. (What makes the air wobble is the shimmer on the map itself, createHeatShimmer.)
    if (uSky2.z > 0.005) {
      float bank = fbm3(px / (uGrid * 11.0) - vec2(t * 0.012, t * 0.03));
      pw = overP(pw, vec3(1.0, 0.92, 0.74), (0.16 + 0.2 * smoothstep(0.32, 0.72, bank)) * uSky2.z * over);
    }
    // Smoke: thick billows rolling with the wind, dark and brown, thinning to haze between them.
    if (uSky2.w > 0.005) {
      vec2 q = px / (uGrid * 6.0) - uWindDir * t * (0.08 + 0.15 * uWind) + vec2(0.0, -t * 0.02);
      vec2 warp = vec2(noise(q * 1.2 + t * 0.04), noise(q * 1.2 + 5.5 - t * 0.03)) - 0.5;
      float body = fbm4(q + warp * 1.5), lit = body - (noise(q * 2.5 + warp * 3.0 + vec2(0.3, -0.3)) - 0.5) * 0.12;
      float billow = smoothstep(0.4, 0.75, body);
      vec3 tone = mix(vec3(0.24, 0.2, 0.17), vec3(0.5, 0.42, 0.34), clamp((lit - body) * 5.0 + 0.5, 0.0, 1.0));
      pw = overP(pw, tone, billow * 0.55 * uSky2.w * over);
    }
    // A light over all: a sunshower's warmth, the gold of divine light, a black sun's pall.
    if (uGlow.a > 0.005) pw = dot(uGlow.rgb, vec3(0.33)) > 0.3 ? addP(pw, uGlow.rgb, uGlow.a * over) : overP(pw, uGlow.rgb, uGlow.a * over);
    // Wisps: faint ribbons streaming with the wind.
    if (uWisps.a > 0.005) {
      vec2 side = vec2(-uWindDir.y, uWindDir.x);
      vec2 q = vec2(dot(px, uWindDir) / (uGrid * 7.0) - t * 0.4, dot(px, side) / (uGrid * 1.6));
      // Spectral wisps: torn, soft ribbons racing with the wind, never a solid edge.
      vec2 warp = vec2(noise(q * 0.8 + t * 0.2), noise(q * 0.8 + 3.3)) - 0.5;
      float body = fbm4(q + warp * 1.4);
      float wisp = smoothstep(0.5, 0.85, body) * (0.45 + 0.55 * noise(q * vec2(3.0, 7.0) + warp * 2.0));
      pw = overP(pw, uWisps.rgb, wisp * uWisps.a * 0.42 * over);
    }
    // Static: the world's grain flickering, and now and then a band torn across it.
    if (uOdd.y > 0.005) {
      float g = hash(floor(px / (uGrid * 0.06)) + floor(t * 14.0));
      float tear = step(0.975, hash(vec2(floor(px.y / (uGrid * 0.3)), floor(t * 6.0))));
      pw = overP(pw, vec3(g * 0.45), (abs(g - 0.5) * 0.3 + tear * 0.35) * uOdd.y * over);
    }
    // A tornado (1) or a dust devil (2) wandering across the map: a spinning funnel of dust and debris.
    if (uSwirlAmount > 0.005) {
      // It goes the way the wind blows, weaving a little, and as it leaves past the far edge it comes in again at the near one.
      float twisterWide = uOdd.w < 1.5 ? 6.0 : 2.5;
      float span = abs(uWindDir.x) * uSize.x + abs(uWindDir.y) * uSize.y + uGrid * (twisterWide * 1.2), along = (fract(t * (0.01 + 0.035 * uWind) * uGrid * 8.0 / span + 0.31) - 0.5) * span;
      vec2 cen = uSize * 0.5 + uWindDir * along + vec2(-uWindDir.y, uWindDir.x) * sin(t * 0.09) * uGrid * 3.5;
      vec2 d = px - cen;
      bool twister = uOdd.w < 1.5;
      float radius = uGrid * (twister ? 6.0 : 2.5), r = length(d) / radius;
      if (r < 1.6) {
      // The air turning: a cloud of dust whose pattern is wound once round the middle.
      float turn = t * (twister ? 4.0 + 5.0 * uWind : 3.0 + 3.0 * uWind) + 1.1 / (0.3 + r);
      vec2 sp = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * (d / radius);
      float dust = fbm4(sp * 2.8 + 11.0) * 0.6 + fbm3(sp * 6.5 - 3.0) * 0.4;
      float body = smoothstep(0.3, 0.8, dust) * (1.0 - smoothstep(0.4, 1.15, r));
      // The funnel itself: dense and dark round a small eye, a skirt of dust thrown out where it meets the ground.
      float wall = smoothstep(0.02, 0.2, r) * (1.0 - smoothstep(0.2, 0.6, r));
      float skirt = (1.0 - smoothstep(0.0, 0.3, abs(r - 0.95))) * smoothstep(0.3, 0.7, fbm3(sp * 4.0 + t * 0.2));
      vec3 tone = twister ? vec3(0.36, 0.34, 0.31) : vec3(0.74, 0.6, 0.4);
      // Its shadow on the ground, cast away from the sun.
      vec2 sd = (d - uCloudShift * 0.6) / radius;
      float shade = (1.0 - smoothstep(0.1, 0.8, length(sd))) * 0.35 * (twister ? 1.0 : 0.5);
      pw = overP(pw, vec3(0.03, 0.03, 0.04), shade * uSwirlAmount * over);
      float mottled = smoothstep(0.3, 0.68, dust);
      pw = overP(pw, tone * (0.5 + 1.0 * mottled), clamp(body * (twister ? 0.75 : 0.5) + wall * (twister ? 0.8 : 0.45) * (0.35 + 0.65 * mottled) + skirt * 0.3, 0.0, 1.0) * uSwirlAmount * over);
      // Debris flung round it.
      float ang = atan(d.y, d.x);
      vec2 pol = vec2(r * 7.0, (ang + t * (5.0 + 4.0 * uWind) / (0.4 + r)) / 6.2832 * 18.0);
      vec2 oid = floor(pol), ofl = fract(pol) - 0.5;
      // Grit the same size however far out: the cells are wider there.
      float grit = length(vec2(ofl.x * radius / 7.0, ofl.y * 6.2832 * r * radius / 18.0)) / uGrid, bit = (twister ? 0.05 : 0.025) * (0.5 + hash(oid + 8.8));
      if (r < 1.4 && hash(oid + 4.4) < (twister ? 0.3 : 0.15)) pw = overP(pw, tone * 0.6, (1.0 - smoothstep(bit * 0.5, bit, grit)) * 0.75 * uSwirlAmount * over);
      }
    }
    gl_FragColor = pw;
    return;
  }
  if (uMode > 2.5) {
    // A flock in a loose V, each bird's shadow beating its wings; drawn over the roofs and trees too ('above').
    float birds = 0.0;
    if (uBird.w > 0.01) {
      // The birds' own scale: the grid's, times the scene's bird size (a city map's squares are wide, its birds small).
      float bs = uGrid * uBird.w;
      vec2 fwd = vec2(cos(uBird.z), sin(uBird.z)), side = vec2(-fwd.y, fwd.x);
      for (int i = 0; i < 7; i++) {
        float fi = float(i), row = floor((fi + 1.0) / 2.0), s = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
        vec2 at = uBird.xy - fwd * row * bs * 0.9 + side * s * row * bs * 0.75 + side * sin(t * 0.7 + fi) * bs * 0.12;
        vec2 d = px - at; d = vec2(dot(d, fwd), dot(d, side)) / bs;
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
    // (The clouds' shadows are drawn over the roofs and trees, with the weather's light.)
    float a = 0.0;
    // Wet ground darkens.
    // (And much more where water stands: a puddle is dark, the ground soaked under it.)
    a = 1.0 - (1.0 - a) * (1.0 - min(1.0, uWet * 0.2 + puddleAt(px) * 0.34) * outside * (1.0 - water));
    // Under the shadows, the season's colour on the grass (never on bare stone, streets or sand: a city's paving tinted
    // green), in soft patches; and the leaves lying.
    vec3 under = vec3(0.0); float ua = 0.0;
    if (uSeason.a > 0.005) {
      float grass = max(texture2D(uTinted, vUv).a, uGrassAll * (1.0 - texture2D(uBare, vUv).a));
      float patch = 0.65 + 0.7 * fbm(px / (uGrid * 5.0));
      ua = uSeason.a * outside * (1.0 - water) * grass * patch;
      under = uSeason.rgb * ua;
    }
    if (uLitter > 0.01) {
      // Fallen leaves where the trees stand and spilling a little past their crowns (the canopy hides what lies right
      // under it), each a small turned oval in an autumn colour. (The crowns' mask is widened by looking a grid and more
      // around, and firmed up.)
      vec2 reach = uGrid * 1.3 / uSize, near = reach * 0.5;
      float trees = max(max(texture2D(uCrowns, vUv).a, max(max(texture2D(uCrowns, vUv + vec2(near.x, 0.0)).a, texture2D(uCrowns, vUv - vec2(near.x, 0.0)).a),
        max(texture2D(uCrowns, vUv + vec2(0.0, near.y)).a, texture2D(uCrowns, vUv - vec2(0.0, near.y)).a))),
        0.7 * max(max(texture2D(uCrowns, vUv + vec2(reach.x, 0.0)).a, texture2D(uCrowns, vUv - vec2(reach.x, 0.0)).a),
        max(texture2D(uCrowns, vUv + vec2(0.0, reach.y)).a, texture2D(uCrowns, vUv - vec2(0.0, reach.y)).a)));
      trees = smoothstep(0.03, 0.3, trees);
      float cell = uGrid * 0.16;
      vec2 c = floor(px / cell), f = fract(px / cell) - 0.5;
      float h = hash(c + 3.7);
      if (h < uLitter * trees * 0.6 * outside * (1.0 - water)) {
        float turn = hash(c + 1.1) * 3.14159, ct = cos(turn), st = sin(turn);
        vec2 q = vec2(ct * f.x - st * f.y, st * f.x + ct * f.y) - (vec2(hash(c + 5.1), hash(c + 7.3)) - 0.5) * 0.4;
        float leaf = 1.0 - smoothstep(0.85, 1.0, length(vec2(q.x / 0.32, q.y / 0.15)));
        vec3 hue = hash(c + 9.9) < 0.33 ? vec3(0.78, 0.42, 0.13) : hash(c + 9.9) < 0.66 ? vec3(0.62, 0.24, 0.1) : vec3(0.82, 0.66, 0.22);
        float la = leaf * 0.85;
        under = under * (1.0 - la) + hue * (0.8 + 0.2 * h) * la; ua = 1.0 - (1.0 - ua) * (1.0 - la);
      }
    }
    gl_FragColor = vec4(vec3(0.04, 0.05, 0.06) * a + under * (1.0 - a), a + ua * (1.0 - a));
    return;
  }
  if (uMode > 1.5) {
    vec3 col = vec3(0.0); float a = 0.0;
    float ice = iceOver(px, water) * outside;
    if (ice > 0.01) {
      // Ice: a pale, matte, faintly blue sheet, clouded where it is thicker, with hairline cracks and a white rime at its
      // creeping edge.
      float cloud = fbm(px / (uGrid * 1.6)), crack = 1.0 - smoothstep(0.0, 0.035, abs(noise(px / (uGrid * 0.55)) - 0.5));
      vec3 sheet = mix(vec3(0.62, 0.74, 0.84), vec3(0.86, 0.92, 0.97), cloud) * (1.0 - 0.22 * crack);
      float rim = ice * (1.0 - smoothstep(0.55, 1.0, ice));
      // It takes the colour of the sun or moon over it, dulled under the trees, and a low sun or a lamp beside it shines on its surface.
      float gleam = uSnowSun.z * (1.0 - 0.9 * texture2D(uTreeShade, vUv).a);
      sheet *= mix(vec3(0.84, 0.87, 0.93), mix(vec3(1.0), uSnowSunColor, 0.55), gleam);
      sheet += uSnowSunColor * gleam * smoothstep(0.5, 2.2, uSnowSun.w) * 0.22 * smoothstep(0.42, 0.7, fbm(px / (uGrid * 2.6) + 4.4));
      sheet += lampsOn(px) * 0.3 * (1.0 - 0.7 * uSnowSun.z);
      col = mix(sheet, vec3(0.96, 0.98, 1.0), rim * 0.6) * ice * 0.78; a = ice * 0.78;
    }
    if (uSnow > 0.01) {
      // Snow lies first in patches, then everywhere open; on water only once it has frozen over.
      float line = 1.0 - uSnow * 1.15, field = snowField(px);
      // Its shape, baked once (SNOW_SHAPE): rg how the surface slopes, b how high it lies.
      vec4 shape = uHasSnowGround > 0.5 ? texture2D(uSnowRelief, vUv) : vec4(0.5, 0.5, 0.5, 1.0);
      vec2 slope = (shape.xy * 2.0 - 1.0) * 2.0;
      // (Its grain three sizes laid at different angles: one alone shows its cells as blocks.)
      vec2 skew = vec2(px.x * 0.8 + px.y * 0.6, px.y * 0.8 - px.x * 0.6), skew2 = vec2(px.x * 0.28 - px.y * 0.96, px.y * 0.28 + px.x * 0.96);
      float high = shape.z, speck = 0.5 * noise(skew / (uGrid * 0.2)) + 0.3 * noise(skew2 / (uGrid * 0.085) + 7.3) + 0.2 * noise(vec2(skew.y, -skew.x) / (uGrid * 0.033) + 3.9), edgeAt = field + (high - 0.5) * 0.14 + (speck - 0.5) * 0.008;
      float lie = smoothstep(line, line + 0.03, edgeAt) * outside * (1.0 - water + ice);
      // Lit from one side: every drift and mound has a bright face and a blue shadow, the form that makes it read as snow and not paint.
      // From the sun or moon where it is now: long soft shading when it is low, little under a closed sky. Each rise throws a shadow away from it.
      vec2 toSun = uSnowSun.xy;
      float blocked = uHasSnowGround > 0.5 ? smoothstep(0.0, 0.1, texture2D(uSnowRelief, vUv + toSun * uGrid * (0.1 + 0.16 * uSnowSun.w) / uSize).z - high) : 0.0;
      float lit = clamp(0.7 - dot(slope, toSun) * (0.26 + uSnowSun.z * (0.26 + 0.2 * uSnowSun.w)) - blocked * uSnowSun.z * 0.42, 0.0, 1.0);
      vec3 tone = mix(vec3(0.62, 0.7, 0.86), mix(vec3(1.0, 0.99, 0.97), uSnowSunColor, 0.6 * uSnowSun.z), lit) * (0.95 + 0.05 * speck);
      // The trees' shade lies on it, blue, where the sun is out.
      tone = mix(tone, tone * vec3(0.62, 0.68, 0.82), texture2D(uTreeShade, vUv).a * uSnowSun.z * 0.9);
      // A lamp or fire nearby catches the side of each rise that faces it. (Most of the light itself is Foundry's, over all this.)
      vec4 lampReach = texture2D(uLampReach, vUv);
      for (int li = 0; li < 3; li++) {
        vec4 lamp = uSnowLights[li];
        if (lamp.z <= 0.0) continue;
        vec2 away = px - lamp.xy; float far = length(away), near = (1.0 - smoothstep(lamp.z * 0.1, lamp.z, far)) * lampReach[li];
        if (near > 0.001) tone *= 1.0 + near * clamp(dot(slope, away / max(far, 1.0)) * 0.9, -0.35, 0.8) * mix(vec3(1.0), uSnowLightColor[li], 0.7) * (1.0 - 0.7 * uSnowSun.z);
      }
      // It lies thick on what rises and thins in the scoured low places, where the ground comes through in a soft dusting.
      float thick = smoothstep(0.2, 0.4, high + (speck - 0.5) * 0.03) * smoothstep(line, line + 0.1, edgeAt);
      float s = lie * mix(0.44 + 0.1 * speck, 0.93, thick);
      // On an ice floor only a dusting, gathered on the rises: its own look shows through. (uFreeze's red marks one.)
      s *= 1.0 - texture2D(uFreeze, vUv).r * (0.92 - 0.45 * smoothstep(0.45, 0.8, high));
      col = col * (1.0 - s) + tone * s; a = 1.0 - (1.0 - a) * (1.0 - s);
    }
    if (uBow.w > 0.01) {
      // A broad, soft arc on the side away from the sun, red outside to violet inside, fading toward its ends.
      vec2 d = px - uBow.xy; float r = length(d) / uBow.z, side = dot(d / max(1.0, length(d)), uBowDir);
      float band = (r - 0.88) / 0.12;
      if (band > 0.0 && band < 1.0 && side > -0.1) {
        vec3 hue = clamp(abs(fract(vec3(0.0, 0.33, 0.67) + (1.0 - band) * 0.8) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
        float s = uBow.w * 0.22 * sin(band * 3.14159) * smoothstep(-0.1, 0.45, side) * outside;
        col = col * (1.0 - s) + hue * s; a = 1.0 - (1.0 - a) * (1.0 - s);
      }
    }
    if (uMist > 0.01) {
      // Mist lies thickest over water and low ground, thinner elsewhere, drifting slowly.
      float low = texture2D(uLow, vUv).g;
      float m = uMist * (0.45 + 0.55 * low) * smoothstep(0.25, 0.65, fbm(px / (uGrid * 6.0) + uWindDir * t * 0.015 + vec2(t * 0.004, 0.0))) * outside * 0.6;
      col = col * (1.0 - m) + vec3(0.86, 0.89, 0.92) * m; a = 1.0 - (1.0 - a) * (1.0 - m);
    }
    gl_FragColor = vec4(col, a);
    return;
  }
  vec3 col = vec3(0.0);
  float banks = texture2D(uLow, vUv).r * (1.0 - water);
  // Frozen water is ice: no sheen, crests, glints or rain rings on it, but it sparkles.
  float iced = iceOver(px, water);
  water *= 1.0 - iced;
  float frozen = max(texture2D(uFrozen, vUv).a, uFrozenAll) * (1.0 - water);
  if (uStrength > 0.02) {
    float light = 0.0;
    // Where the sun reaches the water: not in a wall's shadow (the sunlit floor), not under the trees' shade.
    float sunny = texture2D(uSunlit, vUv).a * (1.0 - 0.9 * texture2D(uTreeShade, vUv).a);
    if (water > 0.01 && sunny > 0.02 && uMovingWater < 0.5) {
      // A river carries its wavelets, sheen and glints downstream; still water goes with the wind.
      vec4 fl = texture2D(uFlow, vUv);
      float flowing = fl.a, current = flowing > 0.01 ? fl.b / fl.a : 0.0;
      // A river slower than gentle (0.4) slows everything on it, the wind's push too.
      float calm = flowing > 0.01 ? clamp(current / 0.4, 0.0, 1.0) : 1.0;
      gDir = flowing > 0.01 ? normalize(fl.rg / fl.a * 2.0 - 1.0 + vec2(1e-4)) : uWindDir;
      gPace = (0.15 + 0.35 * uWind + 1.1 * current) * calm;
      vec2 side = vec2(-gDir.y, gDir.x);
      // Sheen: broad, soft brightness where the surface tilts toward the sun, drifting slowly; strongest on calm water,
      // where it mirrors the sky.
      vec2 w = px / (uGrid * 4.0) + gDir * t * (0.02 + 0.06 * uWind + 0.25 * current) * calm;
      float sheen = smoothstep(0.5, 0.85, fbm(w + vec2(t * 0.01, 0.0)));
      // The wavelets themselves: fine crests across the wind (or the current), travelling with it, faintly lit.
      vec2 f = vec2(dot(px, gDir) / (uGrid * 0.12) - t * (1.5 + 3.0 * uWind + 6.0 * current) * calm, dot(px, side) / (uGrid * 0.5));
      // On a river, long streaks of foam carried downstream.
      float foam = flowing > 0.01 ? smoothstep(0.76, 0.92, noise(vec2(dot(px, gDir) / (uGrid * 0.9) - t * (0.6 + 2.5 * current) * calm, dot(px, side) / (uGrid * 0.07)))) * flowing : 0.0;
      light += water * foam * (0.06 + 0.1 * current);
      float crests = smoothstep(0.62, 0.8, noise(f) * 0.7 + noise(f * 2.3 + 3.1) * 0.3);
      // Glints gather where the sheen tilts the surface to the sun, and spread with the wind.
      float glints = crestGlints(px, t) * (0.35 + 0.65 * sheen);
      light += water * sunny * (sheen * (0.14 - 0.06 * uWind) + crests * (0.03 + 0.04 * uWind) + glints * 3.0);
    }
    if (frozen > 0.01) light += frozen * frostGlint(px, uGrid * 0.12, t, 1.6) * 0.7;
    if (iced > 0.01) light += iced * sunny * frostGlint(px, uGrid * 0.1, t, 1.3) * 0.9;
    // Lying snow sparkles, on the slopes that face the sun or moon. (Most of the map never gets past the glint, so its shape and how far the snow lies are only asked of the few that do.)
    if (uSnow > 0.05 && uHasSnowGround > 0.5) {
      float snowGlint = frostGlint(px, uGrid * 0.08, t, 1.1);
      if (snowGlint > 0.001) {
        vec2 snowSlope = (texture2D(uSnowRelief, vUv).xy * 2.0 - 1.0) * 2.0;
        float snowLine = 1.0 - uSnow * 1.15;
        light += snowGlint * 1.3 * sunny * (1.0 - water) * smoothstep(-0.25, 0.45, -dot(snowSlope, uSnowSun.xy)) * smoothstep(snowLine, snowLine + 0.08, snowField(px));
      }
    }
    if (iced > 0.01) light += iced * outside * twinkle(px, uGrid * 0.1, t, 1.4) * 0.8;
    // Puddles on wet ground catch the sky.
    if (uWet > 0.05) light += puddleAt(px) * outside * (1.0 - water) * 0.16;
    col += uColor * light * outside * uStrength;
  }
  // Standing water holds the sky: a pale, cool sheen, day or night (Foundry's own lighting dims it with the rest). And it mirrors a lamp or torch nearby, in its colour.
  // (Never flat: the surface barely moves, so what it holds shimmers, breaking up toward the middle of the pool.)
  if (uWet > 0.05) { float held = puddleAt(px); if (held > 0.001) { float shimmer = 0.55 + 0.45 * noise(px / (uGrid * 0.2) + vec2(t * 0.25, -t * 0.18)) * noise(px / (uGrid * 0.07) - vec2(t * 0.4, t * 0.3)) * 2.0; col += (vec3(0.34, 0.41, 0.5) * 0.09 + lampsOn(px) * 0.3) * shimmer * held * outside * (1.0 - water); } }
  float rainDim = 0.0;
  if (uRain > 0.01) {
    // Rain on water and on the puddles: where each drop lands a short train of waves runs out as on a pool (drips.mjs), lit on the side facing the light and dark in its troughs, more the harder it rains.
    float puddle = puddleAt(px) * (1.0 - water);
    // (And faintly on any ground that is wet, where each drop lands: most of all on hard floors with no puddle to show it.)
    float film = uWet > 0.05 ? 0.6 * smoothstep(0.05, 0.45, uWet) : 0.0;
    float pool = max(max(water, puddle), film) * outside;
    if (pool > 0.01) {
      vec3 ripple = rainRipples(px, t, uRain, uGrid * 0.42);
      vec2 slope = ripple.xy; float waves = ripple.z;
      if (waves > 0.002) {
        vec3 L = normalize(vec3(-0.55, -0.45, 0.7)), H = normalize(L + vec3(0.0, 0.0, 1.0)), n = normalize(vec3(-slope, 1.0));
        float spec = pow(max(0.0, dot(n, H)), 220.0) * 1.2, shade = (-slope.x * L.x - slope.y * L.y) * 1.6;
        col += (vec3(0.27, 0.24, 0.22) * max(0.0, shade) + vec3(1.0, 0.85, 0.63) * spec) * pool;
        // A puddle has no bright face of its own as open water does, so its rings must carry themselves: pale crests, dark troughs.
        col += vec3(0.68, 0.76, 0.88) * max(0.0, shade) * puddle * outside * 1.5;
        rainDim = clamp(-shade * (0.55 + 0.9 * puddle), 0.0, 0.6) * pool;
      }
    }
  }
  if (uMoon > 0.01) {
    // Silver moonlight on the open ground, broken where a cloud passes over the moon's light.
    vec2 q = px / (uGrid * 9.0) - uWindDir * t * (0.01 + 0.05 * uWind);
    float cloud = uClouds > 0.05 ? smoothstep(1.0 - uClouds - 0.05, 1.0 - uClouds + 0.07, fbm(q)) : 0.0;
    col += vec3(0.58, 0.66, 0.86) * uMoon * 0.22 * outside * (1.0 - 0.85 * cloud) * (0.85 + 0.3 * fbm(px / (uGrid * 12.0)));
  }
  if (uFireflies > 0.01) {
    // Fireflies over the grass and the banks only: each wanders on its own slow loop and glows now and then. (Never over
    // bare ground: a plain map, a street or a dungeon floor, with no season or temperature known, was all lit with them.)
    float place = max(meadow, banks * outside);
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
  float a = max(max(col.r, max(col.g, col.b)), rainDim);
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
// An opening's edge, for the blurred shape given: where it reaches a middling strength, wandering with the noise.
const RAGGED_EDGE = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputSize, outputFrame;
uniform float uCell;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  vec2 w = (vTextureCoord * inputSize.xy + outputFrame.xy) / uCell;
  float wander = 0.55 * noise(w * 0.9 + 3.1) + 0.3 * noise(w * 2.3 + 8.7) + 0.15 * noise(w * 6.1 + 1.9);
  float a = texture2D(uSampler, vTextureCoord).a;
  a = smoothstep(0.3, 0.62, a + (wander - 0.5) * 0.72);
  gl_FragColor = vec4(a);
}
`;
// The shape of lying snow, baked once for a scene: broad drifts, and small mounds gathered here and there at random. Red and green how it slopes, blue how high.
const SNOW_SHAPE = `
precision highp float;
varying vec2 vTextureCoord;
uniform vec4 inputSize, outputFrame;
uniform vec2 uSquares;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s / 0.9375; }
// Now and then in each cell a low mound, never quite round, smooth to its foot.
float mounds(vec2 w, float cell, float seed){
  vec2 c = w / cell + seed, id = floor(c), f = fract(c) - 0.5;
  if (hash(id + seed) > 0.6) return 0.0;
  vec2 at = (vec2(hash(id + 1.7), hash(id + 4.3)) - 0.5) * 0.35;
  float rad = 0.2 + 0.24 * hash(id + 7.1), wobble = 1.0 + 0.7 * (noise(w * 1.6 + seed) - 0.5);
  float d = min(1.0, length((f - at) * vec2(1.0, 0.75 + 0.5 * hash(id + 2.9))) * wobble / rad);
  float dome = 1.0 - d * d * (3.0 - 2.0 * d);
  return dome * (0.5 + 0.5 * hash(id + 5.3));
}
float height(vec2 w){
  vec2 warp = vec2(noise(w * 0.5 + 3.1), noise(w * 0.5 + 8.7)) - 0.5;
  return 0.62 * fbm(w * 0.3 + warp * 0.7 + 2.3) + 0.2 * fbm(w * 1.15 + 9.1) + 0.3 * mounds(w + warp, 2.3, 1.3) + 0.22 * mounds(w - warp, 1.25, 7.7) + 0.035 * fbm(w * 5.0);
}
void main(){
  vec2 uv = vTextureCoord * inputSize.xy / outputFrame.zw, w = uv * uSquares, e = vec2(0.035, 0.0);
  vec2 slope = vec2(height(w + e.xy) - height(w - e.xy), height(w + e.yx) - height(w - e.yx)) / (2.0 * e.x);
  gl_FragColor = vec4(clamp(slope * 0.5, -1.0, 1.0) * 0.5 + 0.5, clamp(height(w), 0.0, 1.0), 1.0);
}
`;
export function createSurfaceLight({ PIXI, root, render, above = root, renderAt = null, glowing = above }) {
  let fallSpeed = 1, gridSize = 100, bakeMarks = null, seeping = false, lampMask = null, lampKey = null, gloomy = false;
  let movingWater = false, masks = [], meshes = [], own = [], hasGlints = false, hasWater = false, origin = { x: 0, y: 0 }, area = null, roofShown = null;
  // The rainbow comes and goes over some seconds, never at once: `bow` where it is now, `bowTo` where look wants it.
  let bow = 0, bowTo = 0;
  // The pass over the roofs: the weather's light (`casting`) and the clouds' shadows (`clouding`).
  let casting = false, tinting = false, clouding = false, weathering = false, fxOn = false, fxShadow = null;
  const drop = () => {
    for (const m of meshes) { try { m.parent?.removeChild(m); m.destroy(); } catch { /* gone with the canvas */ } }
    for (const m of masks) { try { m.destroy(true); } catch { /* gone */ } }
    try { roofShown?.destroy(true); } catch { /* gone */ }
    try { fxShadow?.destroy(true); } catch { /* gone */ }
    meshes = []; masks = []; own = []; area = null; roofShown = null; fxShadow = null; fxOn = false; lampMask = null; lampKey = null;
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
    // Moving water (water-engine.mjs) has its own glints, and takes these off the water.
    movingWater(on) { movingWater = !!on; set({ uMovingWater: movingWater ? 1 : 0 }); },
    build({ water = [], freezes = water, flows = [], icy = [], openRoofed = [], frozen = [], frozenAll = false, grass = [], tinted = [], bare = [], grassAll = false, indoors = [], open = [], bounds, grid = 100 } = {}) {
      drop();
      if (!bounds) return;
      const k = Math.min(RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      // The rivers: each one's direction (red, green: its x and y, from 0 to 1) and current (blue), where it flows.
      const bakeFlow = (list) => {
        const stage = new PIXI.Container(), g = new PIXI.Graphics(), to = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
        for (const river of list) {
          const color = (to(Math.cos(river.angle) * 0.5 + 0.5) << 16) | (to(Math.sin(river.angle) * 0.5 + 0.5) << 8) | to(river.speed);
          for (const p of river.polygons) { const at = (q) => q.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k); g.beginFill(color, 1); g.drawPolygon(at(p)); for (const hole of p.holes ?? []) { g.beginHole(); g.drawPolygon(at(hole)); g.endHole(); } g.endFill(); }
        }
        stage.addChild(g);
        stage.filters = [new PIXI.BlurFilter(2)];
        const texture = PIXI.RenderTexture.create({ width: w, height: h });
        try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
        masks.push(texture);
        return texture;
      };
      const bake = (list, blur, cut = [], red = [], blue = [], green = null, listColor = 0xffffff) => {
        const stage = new PIXI.Container(), g = new PIXI.Graphics(), draw = (shape, polygons, color = 0xffffff) => { for (const p of polygons) { const at = (q) => q.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k); shape.beginFill(color, 1); shape.drawPolygon(at(p)); for (const hole of p.holes ?? []) { shape.beginHole(); shape.drawPolygon(at(hole)); shape.endHole(); } shape.endFill(); } };
        // (`red`, `blue` and `green` in the same picture, kept apart by their colours: this shader has no texture to spare.)
        draw(g, blue, 0x0000ff); draw(g, red, 0xff0000); draw(g, list, listColor);
        stage.addChild(g);
        // `green`: [{ points, alpha }] adding up where they overlap, softened.
        if (green?.length) {
          const air = new PIXI.Graphics(), soft = new PIXI.BlurFilter(Math.max(2, grid * k * 0.4), 3);
          for (const shape of green) { air.beginFill(0x00ff00, shape.alpha); air.drawPolygon(shape.points.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k)); air.endFill(); }
          air.blendMode = PIXI.BLEND_MODES.ADD; soft.blendMode = PIXI.BLEND_MODES.ADD;
          air.filters = [soft]; air.filterArea = new PIXI.Rectangle(0, 0, w, h);
          stage.addChild(air);
        }
        // What is cut away (open to the sky) has no drawn edge: blurred, then that blur's middle pushed in and out at random, so it comes out an uneven shape with a soft rim.
        if (cut.length) {
          const out = new PIXI.Graphics(), edge = new PIXI.Filter(undefined, RAGGED_EDGE, { uCell: grid * k });
          draw(out, cut);
          edge.blendMode = PIXI.BLEND_MODES.ERASE;
          out.filters = [new PIXI.BlurFilter(Math.max(2, grid * k * 0.45), 4), edge];
          out.filterArea = new PIXI.Rectangle(0, 0, w, h);
          stage.addChild(out);
        }
        stage.filters = [new PIXI.BlurFilter(blur)];
        const texture = PIXI.RenderTexture.create({ width: w, height: h });
        try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
        masks.push(texture);
        return texture;
      };
      const bakeWidened = () => {
        const stage = new PIXI.Container(), spread = (blur, color) => { const g = new PIXI.Graphics(), soft = new PIXI.BlurFilter(blur); for (const p of water) { const at = (q) => q.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k); g.beginFill(color, 1); g.drawPolygon(at(p)); for (const hole of p.holes ?? []) { g.beginHole(); g.drawPolygon(at(hole)); g.endHole(); } g.endFill(); } g.blendMode = PIXI.BLEND_MODES.ADD; soft.blendMode = PIXI.BLEND_MODES.ADD; g.filters = [soft]; g.filterArea = new PIXI.Rectangle(0, 0, w, h); stage.addChild(g); };
        spread(6 + grid * k * 0.25, 0xff0000); spread(10 + grid * k * 1.5, 0x00ff00);
        const texture = PIXI.RenderTexture.create({ width: w, height: h });
        try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
        masks.push(texture);
        return texture;
      };
      origin = { x: bounds.x, y: bounds.y }; gridSize = grid;
      area = { k: k * 0.5, bounds, w: Math.max(1, Math.ceil(bounds.width * k * 0.5)), h: Math.max(1, Math.ceil(bounds.height * k * 0.5)) };
      hasGlints = water.length > 0 || frozen.length > 0 || frozenAll;
      hasWater = water.length > 0;
      // The banks: a wider, softer water, so the ripples' light spills a little onto the ground beside it; the low
      // ground the mist gathers on: wider still.
      const uniforms = {
        uWater: bake(water, 1), uLow: bakeWidened(), uFrozen: bake(frozen, 2), uFreeze: (bakeMarks = (green) => bake(freezes, 1, [], icy, openRoofed, green, 0x000000))(null), uFlow: flows.length ? bakeFlow(flows) : PIXI.Texture.EMPTY, uIndoor: bake(indoors, 1, open),
        uGrass: bake(grass, 2), uTinted: tinted.length ? bake(tinted, grid * k * 0.3) : PIXI.Texture.EMPTY, uBare: bake(bare, 2), uRoofShown: PIXI.Texture.EMPTY, uSunlit: PIXI.Texture.WHITE, uTreeShade: PIXI.Texture.EMPTY, uCrowns: PIXI.Texture.EMPTY,
        uSize: [bounds.width, bounds.height], uWindDir: [Math.SQRT1_2, Math.SQRT1_2], uBird: [0, 0, 0, 0], uTime: 0, uWind: 0.3, uStrength: 0, uClouds: 0,
        uGrid: grid, uMovingWater: movingWater ? 1 : 0, uMode: 0, uFrozenAll: frozenAll ? 1 : 0, uGrassAll: grassAll ? 1 : 0, uWet: 0, uSnow: 0, uMist: 0, uFireflies: 0, uRain: 0, uIce: 0, uLitter: 0, uSeason: [0, 0, 0, 0], uMoon: 0, uBow: [0, 0, 1, 0], uBowDir: [0, 1], uAmbient: [1, 1, 1, 0], uVeil: [1, 1, 1, 0], uFxClouds: PIXI.Texture.EMPTY, uFxShift: [0, 0], uFxOn: 0, uFallA: [0, 0, 1, 0], uFallAColor: [1, 1, 1, 1], uFallB: [0, 0, 1, 0], uFallBColor: [1, 1, 1, 1], uFogW: [1, 1, 1, 0], uCloudSky: [1, 1, 1, 0], uGlow: [1, 1, 1, 0], uAurora: [0, 0, 0, 0], uSparks: [0, 0, 0, 0], uWisps: [0, 0, 0, 0], uOdd: [0, 0, 0, 0], uCloudShift: [0, 0], uCover: 0, uSwirlAmount: 0, uFallsDown: 0, uFallTime: 0, uGloom: 0, uGloomLift: 0, uEye: [0, 0, 1000], uSnowRelief: PIXI.Texture.WHITE, uLampReach: PIXI.Texture.WHITE, uHasSnowGround: 0, uSnowSun: [-0.6, -0.5, 0.5, 0.8], uSnowSunColor: [1, 0.97, 0.9], uSnowLights: new Float32Array(16), uSnowLightColor: new Float32Array(12), uDeck: [0, 0, 0, 1], uSky: [0, 0, 0, 0], uSky2: [0, 0, 0, 0], uColor: [1, 0.95, 0.84],
      };
      const geometry = new PIXI.Geometry()
        .addAttribute('aVertexPosition', [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height, bounds.x, bounds.y + bounds.height], 2)
        .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
      own = [uniforms, { ...uniforms, uMode: 1 }, { ...uniforms, uMode: 2 }, { ...uniforms, uMode: 3 }, { ...uniforms, uMode: 4 }, { ...uniforms, uMode: 5 }, { ...uniforms, uMode: 6 }];
      const shade = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[0]));
      const light = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[1]));
      const pale = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[2]));
      const flock = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[3]));
      const veil = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[4]));
      const glow = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[5]));
      const air = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[6]));
      air.blendMode = PIXI.BLEND_MODES.MULTIPLY;
      glow.blendMode = PIXI.BLEND_MODES.ADD;
      light.blendMode = PIXI.BLEND_MODES.ADD;
      meshes = [shade, light, pale, flock, veil, glow, air];
      for (const m of meshes) { m.eventMode = 'none'; m.visible = false; (m === glow ? glowing : m === flock || m === veil || m === air ? above : root)().addChild(m); }
    },
    look({ light = 0, clouds = 0, color = [1, 0.95, 0.84], wind = 0.3, windAngle = Math.PI / 4, wet = 0, snow = 0, mist = 0, fireflies = 0, rain = 0, ice = 0, season = null, litter = 0, moon = 0, rainbow = 0, sunAngle = 0, weather = null, cover = 0, cloudShift = { x: 0, y: 0 }, raining = false, fallsDown = false, snowSun = null, bowAngle = null, bowSize = 1, gloom = 0 } = {}) {
      if (!own.length) return;
      const sunny = light > 0.02, bowSun = bowAngle ?? sunAngle;
      set({ uStrength: sunny ? light : 0, uClouds: clouds, uFallsDown: Number(fallsDown) || 0, uGloom: gloom, uSnowSun: snowSun ? [snowSun.toSun[0], snowSun.toSun[1], Math.min(1, snowSun.shine), snowSun.reach] : [-0.6, -0.5, 0, 0.8], uSnowSunColor: snowSun?.color ?? [1, 0.97, 0.9], uDeck: cloudLook(clouds, raining), uColor: color, uWind: wind, uWindDir: [Math.cos(windAngle), Math.sin(windAngle)], uWet: wet, uSnow: snow, uMist: mist, uFireflies: fireflies, uRain: rain, uIce: hasWater ? ice : 0, uSeason: season ?? [0, 0, 0, 0], uLitter: litter, uMoon: moon,
        // The rainbow faces away from the sun: its centre off toward the sun, so the arc sweeps across the middle of the map.
        uBow: area ? [area.bounds.width / 2 + Math.cos(bowSun) * area.bounds.width * 0.3, area.bounds.height / 2 + Math.sin(bowSun) * area.bounds.height * 0.3, Math.min(area.bounds.width, area.bounds.height) * 0.45 * bowSize, bow] : [0, 0, 1, 0],
        uBowDir: [-Math.cos(bowSun), -Math.sin(bowSun)] });
      meshes[0].visible = wet > 0.02 || (season?.[3] ?? 0) > 0.005 || litter > 0.01;
      clouding = light > 0.005 && (clouds > 0.05 || fxOn);
      gloomy = gloom > 0.005;
      meshes[4].visible = clouding || casting || weathering || gloomy;
      meshes[3].visible = sunny && own[0].uBird[3] > 0.01;
      meshes[1].visible = (sunny && hasGlints) || wet > 0.05 || fireflies > 0.01 || (rain > 0.01 && (hasWater || wet > 0.05)) || moon > 0.01 || (sunny && (snow > 0.05 || (hasWater && ice > 0.05)));
      // The weather on the map (sky-weather.mjs weatherScene; null none), drawn over the roofs.
      fallSpeed = weather?.speed ?? 1;
      const fall = (f) => (f ? [f.kind, f.amount, f.size, 0] : [0, 0, 1, 0]), tint = (f) => (f ? [...f.color, 1] : [1, 1, 1, 1]);
      set({ uFallA: fall(weather?.falls?.[0]), uFallAColor: tint(weather?.falls?.[0]), uFallB: fall(weather?.falls?.[1]), uFallBColor: tint(weather?.falls?.[1]),
        uFogW: weather?.fog ?? [1, 1, 1, 0], uCloudSky: weather ? weather.clouds : [1, 1, 1, 0], uGlow: weather?.glow ?? [1, 1, 1, 0], uAurora: weather?.aurora ?? [0, 0, 0, 0],
        uSparks: weather?.sparks ?? [0, 0, 0, 0], uWisps: weather?.wisps ?? [0, 0, 0, 0], uOdd: [weather?.rays ?? 0, weather?.noise ?? 0, weather?.meteors ?? 0, weather?.swirl?.[0] ?? 0],
        uSwirlAmount: weather?.swirl?.[1] ?? 0, uCover: cover, uCloudShift: [cloudShift.x, cloudShift.y],
        uSky: [weather?.deck ?? 0, weather?.mist ?? 0, weather?.curtains ?? 0, weather?.bands ?? 0], uSky2: [weather?.glaze ?? 0, weather?.frost ?? 0, weather?.heat ?? 0, weather?.smoke ?? 0] });
      weathering = !!weather && (weatherDrawn(weather) || cover > 0.05);
      meshes[5].visible = !!weather && (weather.rays > 0.01 || weather.aurora[3] > 0.01 || weather.sparks[3] > 0.01 || weather.meteors > 0.01 || weather.falls.some((f) => f.kind === 9 && f.amount > 0.01));
      bowTo = rainbow;
      meshes[2].visible = snow > 0.01 || mist > 0.01 || (hasWater && ice > 0.01) || Math.max(bow, bowTo) > 0.01;
    },
    // The weather's light (weatherLight's [r, g, b, strength]) over the open ground and `roofs` as drawn now (as bird's):
    // called again as the roofs fade.
    veil(cast = null, roofs = []) {
      if (!own.length) return;
      casting = !!cast && cast[3] > 0.01;
      if (casting || tinting || clouding || weathering) drawRoofs(roofs);
      for (const u of own) u.uVeil = casting ? cast : [1, 1, 1, 0];
      meshes[4].visible = casting || clouding || weathering;
    },
    // The open air's colour (skyTint's [r, g, b, how much], null none), over the open ground and `roofs` as drawn now.
    tint(colour = null, roofs = []) {
      if (!own.length) return;
      tinting = !!colour && colour[3] > 0.002;
      if (tinting) drawRoofs(roofs);
      for (const u of own) u.uAmbient = tinting ? colour : [1, 1, 1, 0];
      meshes[6].visible = tinting;
    },
    // FXMaster's clouds (`clouds` their particles' container, null none): drawn small into a picture of the map, their
    // shadows thrown `shift` ({ x, y } scene pixels) away from the sun. Called a few times a second while they show.
    fxClouds(clouds = null, shift = { x: 0, y: 0 }) {
      if (!own.length || !area) return;
      fxOn = !!clouds && !!renderAt;
      if (fxOn) {
        fxShadow ??= PIXI.RenderTexture.create({ width: area.w, height: area.h });
        const { k, bounds } = area, keep = clouds.filters;
        clouds.filters = null;
        try { renderAt(clouds, fxShadow, new PIXI.Matrix(k, 0, 0, k, -bounds.x * k, -bounds.y * k)); } catch { fxOn = false; } finally { clouds.filters = keep; }
      }
      set({ uFxClouds: fxOn ? fxShadow : PIXI.Texture.EMPTY, uFxOn: fxOn ? 1 : 0, uFxShift: [shift.x / area.bounds.width, shift.y / area.bounds.height] });
      clouding = own[0].uStrength > 0.005 && (own[0].uClouds > 0.05 || fxOn);
      meshes[4].visible = casting || clouding || weathering;
    },
    bird(flock, roofs = []) {
      if (!own.length) return;
      if (flock) drawRoofs(roofs);
      set({ uBird: flock ? [flock.x - origin.x, flock.y - origin.y, flock.angle, Math.max(0.05, Number(flock.scale) || 1)] : [0, 0, 0, 0] });
      meshes[3].visible = !!flock && own[0].uStrength > 0.02;
    },
    // Where the sun reaches, for the water's light: `sunlit` the wall shadows' sunlit floor (null: everywhere), `trees`
    // the trees' baked shade (null: none); both over the same scene rectangle as the rest.
    shade({ sunlit = null, trees = null, crowns = null } = {}) { set({ uSunlit: sunlit ?? PIXI.Texture.WHITE, uTreeShade: trees ?? PIXI.Texture.EMPTY, uCrowns: crowns ?? PIXI.Texture.EMPTY }); },
    tick(seconds) {
      // (What falls keeps its own clock: a change of speed carries on from where it is, not a jump.)
      for (const u of own) { u.uTime += seconds; u.uFallTime += seconds * fallSpeed; }
      if (bow !== bowTo) {
        bow += Math.max(-seconds / 8, Math.min(seconds / 8, bowTo - bow));
        for (const u of own) u.uBow[3] = bow;
        if (bow <= 0.01 && bowTo <= 0.01 && meshes[2]) { bow = 0; for (const u of own) u.uBow[3] = 0; }
      }
    },
    clear: drop,
    get shown() { return meshes.some((m) => m.visible); },
    // The clock its clouds run by, for anything that must agree on where they are.
    // The shape of the snow lying on the ground is baked here the first time snow lies on this scene, once.
    snowGround() {
      if (!own.length || own[0].uHasSnowGround) return;
      const bounds = area.bounds, k = Math.min(1, 2048 / Math.max(1, bounds.width, bounds.height)), w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      const texture = PIXI.RenderTexture.create({ width: w, height: h }), stage = new PIXI.Container(), sheet = new PIXI.Sprite(PIXI.Texture.WHITE);
      sheet.width = w; sheet.height = h; stage.addChild(sheet);
      stage.filters = [new PIXI.Filter(undefined, SNOW_SHAPE, { uSquares: [bounds.width / gridSize, bounds.height / gridSize] })];
      stage.filterArea = new PIXI.Rectangle(0, 0, w, h);
      try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      masks.push(texture);
      for (const u of own) { u.uSnowRelief = texture; u.uHasSnowGround = 1; }
    },
    // Fog and mist come indoors (air-seep.mjs): [{ points (map pixels), alpha }], adding up where they overlap. Drawn again only when told.
    seep(shapes = []) {
      if (!own.length || !bakeMarks || (!shapes.length && !seeping)) return;
      const old = own[0].uFreeze, next = bakeMarks(shapes);
      for (const u of own) u.uFreeze = next;
      seeping = shapes.length > 0;
      const at = masks.indexOf(old); if (at >= 0) masks.splice(at, 1);
      try { old.destroy(true); } catch { /* gone */ }
    },
    // A flash of lightning, this moment (0-1): the gloom gives way to it.
    flash(level) { if (!own.length || !(own[0].uGloom > 0.005)) return; const lift = Math.min(1, Math.max(0, level)) * 0.85; if (lift !== own[0].uGloomLift) for (const u of own) u.uGloomLift = lift; },
    // The nearest lights, for the snow lying on the ground to catch (only worth asking while it does). `at` where the view is, `lights` () => [{ x, y, radius, color }].
    // (`reachOf(light)`: how far it gets, a polygon in map pixels, walls and all; none: all round.)
    lampsMoved() { lampKey = null; },
    snowLights(lights, at, most = 3, reachOf = null) {
      if (!own.length || !(own[0].uSnow > 0.01 || own[0].uIce > 0.01 || own[0].uWet > 0.05 || own[0].uGloom > 0.005)) return;
      const near = nearestLights(lights(), at, Math.min(3, most)), where = own[0].uSnowLights, colors = own[0].uSnowLightColor;
      for (let i = 0; i < 4; i++) {
        const l = near[i], c = l?.color ?? [1, 0.82, 0.6];
        where[i * 4] = l ? l.x - origin.x : 0; where[i * 4 + 1] = l ? l.y - origin.y : 0; where[i * 4 + 2] = l?.radius ?? 0;
        colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
      }
      // Drawn again only when one has moved, or a wall or door has changed.
      const key = near.map((l) => `${Math.round(l.x)},${Math.round(l.y)},${Math.round(l.radius)}`).join(';');
      if (key === lampKey || !area) return;
      lampKey = key;
      const stage = new PIXI.Container(), { bounds, k: scale, w, h } = area, tints = [0xff0000, 0x00ff00, 0x0000ff];
      near.forEach((l, i) => {
        let points = null; try { points = reachOf?.(l) ?? null; } catch { /* no wall test */ }
        const g = new PIXI.Graphics(); g.beginFill(tints[i], 1);
        if (points) { if (points.length >= 6) g.drawPolygon(points.map((v, n) => (v - (n % 2 ? bounds.y : bounds.x)) * scale)); } else g.drawRect(0, 0, w, h);
        g.endFill(); g.blendMode = PIXI.BLEND_MODES.ADD; stage.addChild(g);
      });
      if (!lampMask) { lampMask = PIXI.RenderTexture.create({ width: w, height: h }); masks.push(lampMask); }
      try { render(stage, lampMask); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      for (const u of own) u.uLampReach = lampMask;
    },
    // Where the camera is, for what is seen from straight above: { x, y } the view's middle on the map, `reach` how far its corners are. Only worth doing then.
    eye({ x, y, reach }) { if (!own.length || !(own[0].uFallsDown > 1.5)) return; const at = [x - origin.x, y - origin.y, Math.max(1, reach)]; for (const u of own) u.uEye = at; },
    get clock() { return own[0]?.uTime ?? 0; },
    // Whether a pass over the roofs shows (so the roofs it reads are kept up as they fade).
    get veiling() { return !!meshes[4]?.visible || !!meshes[6]?.visible; },
    // Whether its passes exist on this screen (not at low quality, or with everything of it turned off).
    get built() { return own.length > 0; },
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
float noise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f);
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
      filter.uniforms.uAmp = 5.5 * heat;
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
// How hard a flash that landed on the map hits (pure, its strength: 1 the plain flash, as FLASH_PEAK): near whoever sees it, it all but washes the map out, thinning to the plain flash across the map. `squares` how far off, `span` how far is far here.
const FLASH_PEAK = 0.55;
export const landedFlash = (squares = 0, span = 32) => { const k = Math.min(1, Math.max(0, squares / Math.max(14, span))); return (0.85 - 0.3 * k * (2 - k)) / FLASH_PEAK; };
// `dim()`: this player's own say over how bright flashes are (1 as they come).
export function createLightningFlash({ PIXI, root, bounds, random = Math.random, render = null, cover = null, dim = () => 1 }) {
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
    // What is open to the sky takes the flash whole.
    const holes = new PIXI.Graphics();
    for (const p of what.open ?? []) { holes.beginFill(0xffffff, 1); holes.drawPolygon(at(p)); for (const hole of p.holes ?? []) { holes.beginHole(); holes.drawPolygon(at(hole)); holes.endHole(); } holes.endFill(); }
    stage.addChild(open, rooms, through, holes);
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
      const bright = Math.min(1, FLASH_PEAK * level * Math.max(0, Number(dim()) || 0));
      if (s.lit) { s.shader.uniforms.uAlpha = bright; s.alpha = 1; }
      else { const r = bounds(); s.position.set(r.x, r.y); s.width = r.width; s.height = r.height; s.alpha = bright; }
      s.visible = level > 0;
      if (level <= 0 && now - struckAt > 600) struckAt = null;
      return level;
    },
    strike(now) { struckAt = now; strength = 1; this.rebake = true; },
    // This flash landed on the map: as hard as it hits from here (landedFlash).
    landed(power = 1) { strength = power; },
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
uniform sampler2D uSnowTile;
uniform float uAmount, uShown, uTree, uGrid, uHasSnowTile, uTime;
uniform vec2 uTexel;
uniform vec4 uSun;          // toward the sun or moon (x, y), how much of it reaches here, how low it is
uniform vec3 uSunColor;
uniform vec4 uLamps[4];     // the nearest lights outdoors: x, y, radius (0 none)
uniform vec3 uLampColor[4];
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
// The blanket's surface: broad soft swells and smaller folds, and the roof's own ridges and valleys lifting and dipping it from under.
float blanket(vec2 w, vec2 uv){
  float swell = noise(w / (uGrid * 3.4)) * 0.6 + noise(w / (uGrid * 1.3) + 5.1) * 0.3 + noise(w / (uGrid * 0.5) + 2.3) * 0.1;
  vec2 far = uTexel * 2.2;
  vec3 under = (texture2D(uTile, uv + vec2(far.x, 0.0)).rgb + texture2D(uTile, uv - vec2(far.x, 0.0)).rgb + texture2D(uTile, uv + vec2(0.0, far.y)).rgb + texture2D(uTile, uv - vec2(0.0, far.y)).rgb) * 0.25;
  return swell + dot(under, vec3(0.3, 0.59, 0.11)) * 0.32;
}
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
    // It comes in patches as it first falls, joining into one thick blanket over the whole roof: rounded at the eaves, no roof left showing.
    float patches = noise(vWorld / (uGrid * 1.7)) * 0.55 + noise(vWorld / (uGrid * 0.62) + 3.7) * 0.3 + noise(vWorld / (uGrid * 0.2) + 9.1) * 0.15;
    float line = mix(0.9, 0.08, smoothstep(0.02, 0.6, uAmount));
    cover = smoothstep(line - 0.05, line + 0.08, patches + 0.05 * (grain - 0.5));
  }
  float a = cover * c.a * uShown;
  vec3 snow;
  float bright = 0.5;
  if (uTree > 0.5) {
    // Lit on the side of each clump toward the sun or moon, by the tile's own light and dark.
    float toward = dot(texture2D(uTile, vUv + uSun.xy * uTexel * 1.4).rgb, vec3(0.3, 0.59, 0.11));
    float side = clamp(0.6 + (luma - toward) * (0.8 + 2.4 * uSun.z), 0.0, 1.0);
    snow = mix(vec3(0.62, 0.69, 0.84), mix(vec3(0.92, 0.95, 0.99), uSunColor, 0.55 * uSun.z), side) * (0.86 + 0.1 * grain) * mix(0.8, 1.0, lit);
    bright = side;
  } else {
    // Its own painted snow, lit from one side off its swells: bright where they face the light, soft blue in their lee, and blue again as it rounds over the edge.
    vec3 flake = uHasSnowTile > 0.5 ? mix(texture2D(uSnowTile, vWorld / (uGrid * 4.0)).rgb, texture2D(uSnowTile, vec2(vWorld.y, -vWorld.x) / (uGrid * 5.3) + 0.37).rgb, 0.5) : vec3(0.95, 0.96, 0.98) * (0.94 + 0.06 * grain);
    // (From the sun or moon where it is now; long soft shading when it is low, little under a closed sky.)
    vec2 toLight = uSun.xy * uGrid * 0.32;
    float face = clamp(0.56 + (blanket(vWorld, vUv) - blanket(vWorld + toLight, vUv + toLight * uTexel / (uGrid * 0.14))) * (0.9 + uSun.z * (1.3 + 0.75 * uSun.w)), 0.0, 1.0);
    float eaves = min(min(texture2D(uTile, vUv + vec2(uTexel.x, 0.0)).a, texture2D(uTile, vUv - vec2(uTexel.x, 0.0)).a), min(texture2D(uTile, vUv + vec2(0.0, uTexel.y)).a, texture2D(uTile, vUv - vec2(0.0, uTexel.y)).a));
    snow = flake * mix(vec3(0.6, 0.67, 0.82), mix(vec3(1.05, 1.04, 1.02), uSunColor * 1.05, 0.6 * uSun.z), smoothstep(0.1, 0.85, face)) * mix(vec3(0.72, 0.78, 0.9), vec3(1.0), smoothstep(0.2, 0.95, eaves));
    bright = smoothstep(0.45, 0.8, face);
  }
  // Points of light on what faces the sun or moon.
  if (uSun.z > 0.05) {
    vec2 cell = vWorld / (uGrid * 0.08), id = floor(cell);
    float h = hash(id), on = step(0.8, hash(id + 5.9)) * pow(max(0.0, sin(uTime * 1.1 * (0.6 + h) + h * 40.0)), 10.0);
    if (on > 0.001) snow += uSunColor * on * uSun.z * bright * 1.3 * (1.0 - smoothstep(0.03, 0.12, length(fract(cell) - 0.5 - (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6)));
  }
  // A lamp or fire nearby warms it.
  for (int li = 0; li < 4; li++) {
    vec4 lamp = uLamps[li];
    if (lamp.z <= 0.0) continue;
    float near = 1.0 - smoothstep(lamp.z * 0.1, lamp.z, length(vWorld - lamp.xy));
    if (near > 0.001) snow *= 1.0 + near * near * 0.45 * mix(vec3(1.0), uLampColor[li], 0.7) * (1.0 - 0.7 * uSun.z);
  }
  gl_FragColor = vec4(snow * a, a);
}`;

// Snow on the overhead tiles: one mesh a roof or tree tile, reading the tile's own picture (its leaves, its roof),
// over the tiles in `root()`. build({ tiles: [{ kind 'roof' | 'tree', texture, x, y, width, height, rotation, anchorX,
// anchorY, shown }], grid }) makes them; look({ snow, wind }) how much lies (the ground's snow, 0–1, and the wind 0–1);
// shown(values) each tile as drawn now (a roof faded for a creature inside takes its snow with it); clear() drops them.
// Hidden while no snow lies: nothing drawn.
export function createTileSnow({ PIXI, root, snowTile = () => null }) {
  let meshes = [], sunNow = [-0.6, -0.8, 0, 0.8], sunColorNow = [1, 0.97, 0.9], clock = 0;
  const lampSpots = new Float32Array(16), lampColors = new Float32Array(12);
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
        const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(TILE_SNOW_VERT, TILE_SNOW_FRAG, { uTile: t.texture, uAmount: 0, uShown: Number.isFinite(t.shown) ? t.shown : 1, uTree: t.kind === 'tree' ? 1 : 0, uGrid: grid, uSnowTile: PIXI.Texture?.WHITE, uHasSnowTile: 0, uTexel: [(Math.abs(uv.x1 - uv.x0) * grid * 0.14) / w, (Math.abs(uv.y2 - uv.y1) * grid * 0.14) / h], uTime: 0, uSun: sunNow, uSunColor: sunColorNow, uLamps: lampSpots, uLampColor: lampColors }));
        mesh.eventMode = 'none';
        mesh.visible = false;
        mesh.kind = t.kind;
        root().addChild(mesh);
        meshes.push(mesh);
      }
    },
    look({ snow = 0, wind = 0, sun = null } = {}) {
      sunNow = sun ? [sun.toSun[0], sun.toSun[1], Math.min(1, sun.shine), sun.reach] : [-0.6, -0.8, 0, 0.8]; sunColorNow = sun?.color ?? [1, 0.97, 0.9];
      for (const m of meshes) { m.shader.uniforms.uSun = sunNow; m.shader.uniforms.uSunColor = sunColorNow; }
      // (Its painted snow only once there is any: it takes a moment to make the first time.)
      if (snow > 0.01 && meshes.length) { let tile = null; try { tile = snowTile(); } catch { /* none yet */ } if (tile) for (const m of meshes) { m.shader.uniforms.uSnowTile = tile; m.shader.uniforms.uHasSnowTile = 1; } }
      for (const m of meshes) {
        const amount = tileSnowOf(snow, { kind: m.kind, wind });
        m.shader.uniforms.uAmount = amount;
        m.visible = amount > 0.01;
      }
    },
    tick(seconds) { clock += seconds; for (const m of meshes) if (m.visible) m.shader.uniforms.uTime = clock; },
    // The nearest lights outdoors: [{ x, y, radius, color }], at most four.
    lights(near = []) { for (let i = 0; i < 4; i++) { const l = near[i], c = l?.color ?? [1, 0.82, 0.6]; lampSpots[i * 4] = l?.x ?? 0; lampSpots[i * 4 + 1] = l?.y ?? 0; lampSpots[i * 4 + 2] = l?.radius ?? 0; lampColors[i * 3] = c[0]; lampColors[i * 3 + 1] = c[1]; lampColors[i * 3 + 2] = c[2]; } },
    shown(values = []) { meshes.forEach((m, i) => { if (Number.isFinite(values[i])) m.shader.uniforms.uShown = values[i]; }); },
    clear: drop,
    get built() { return meshes.length > 0; },
    get showing() { return meshes.some((m) => m.visible); },
  };
}

// A rainbow after the rain (0 none – 1 at its brightest): with the sun out (not the moon, well up and strong), once the
// rain has stopped and only while the ground is fresh from it (`wet` 0–1, drying from 1 after the rain: gone by 0.9, about
// the first hour), fading as it dries, and none under a heavy sky (`clouds` 0–1).
export function rainbowOf({ wet = 0, raining = false, sun = null, clouds = 0 } = {}) {
  if (raining || !sun || sun.moon || !((Number(sun.strength) || 0) > 0.3)) return 0;
  const fresh = Math.min(1, Math.max(0, ((Number(wet) || 0) - 0.9) / 0.08)), open = Math.min(1, Math.max(0, 1 - (Number(clouds) || 0) * 1.3));
  return fresh * open * Math.min(1, Number(sun.strength) || 0);
}

// How much snow lies at a point (0–1) while it lies in patches (`snow` the ground's, 0–1): the shader's snowPatch, so a
// creature leaves tracks only where snow is drawn. `x`, `y` from the scene's top-left corner (its sceneRect), in pixels.
const fract = (v) => v - Math.floor(v);
const patchHash = (x, y) => {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d; b += d; c += d;
  return fract((a + b) * c);
};
const patchNoise = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const mix = (p, q, t) => p + (q - p) * t;
  return mix(mix(patchHash(ix, iy), patchHash(ix + 1, iy), fx), mix(patchHash(ix, iy + 1), patchHash(ix + 1, iy + 1), fx), fy);
};
export function snowPatchAt({ x = 0, y = 0 } = {}, snow = 0, grid = 100) {
  let px = x / (grid * 4), py = y / (grid * 4), s = 0, a = 0.5;
  for (let i = 0; i < 5; i++) { s += a * patchNoise(px, py); px = px * 2.03 + 17; py = py * 2.03 + 17; a *= 0.5; }
  const lo = 1 - snow * 1.15, hi = 1.05 - snow * 1.15, t = Math.min(1, Math.max(0, (s - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

// The moonlight on the open ground (0–1) for a moon `lit` 0–1. When Calendaria already lifts the whole night by the
// moon (its darkness follows the moon phase: `calendariaLifts`), this only gives the open ground its silver and the
// clouds' shadows, at half, so the two do not brighten the night twice.
export const moonGlow = (lit, { calendariaLifts = false } = {}) => Math.min(1, Math.max(0, Number(lit) || 0)) * (calendariaLifts ? 0.5 : 1);
// Whether Calendaria's darkness follows the moon on a scene: its scene choice ('default' follows the world setting), and
// only while its darkness follows the clock at all.
export function calendariaMoonLifts({ active = false, sync = false, moonSync = false, sceneSync = 'default', sceneMoonSync = 'default' } = {}) {
  if (!active) return false;
  const pick = (own, world) => (own === true || own === 'true' || own === 'enabled' ? true : own === false || own === 'false' || own === 'disabled' ? false : !!world);
  return pick(sceneSync, sync) && pick(sceneMoonSync, moonSync);
}

// The weather's light outdoors ([r, g, b, strength], laid over the open ground and the roofs as a dark wash; strength 0
// none): a grey sky's flat, cool light, rain's grey-blue, a thunderstorm's dark green-grey (deeper the fiercer), falling
// snow's pale cold, a sandstorm's dusty amber. `kind` the weather's name (Calendaria's or the scene's), `rain`/`snow` what
// falls (0–1), `storm`/`severity` a thunderstorm and how fierce, `clouds` the cover (0–1), `day` the daylight (0 night – 1
// noon: by night the darkness does most of it, so less).
export function weatherLight({ kind = '', rain = 0, snow = 0, storm = false, severity = 0, clouds = 0, day = 1 } = {}) {
  const named = String(kind ?? '').toLowerCase(), clamp = (v) => Math.min(1, Math.max(0, Number(v) || 0));
  if (/sunshower|heat-wave/.test(named)) return [1, 1, 1, 0];
  const casts = [];
  if (/sand|dust/.test(named)) casts.push([0.95, 0.74, 0.48, 0.6]);
  if (storm) casts.push([0.46, 0.56, 0.56, 0.6 + 0.3 * clamp(severity)]);
  if (rain > 0.05) casts.push([0.62, 0.7, 0.8, 0.45 + 0.25 * clamp(rain)]);
  if (snow > 0.05) casts.push([0.8, 0.87, 1, 0.3 + 0.2 * clamp(snow)]);
  if (clamp(clouds) > 0.5) casts.push([0.76, 0.8, 0.88, 0.5 * (clamp(clouds) - 0.5) / 0.5]);
  if (!casts.length) return [1, 1, 1, 0];
  const [r, g, b, s] = casts.reduce((m, c) => (c[3] > m[3] ? c : m));
  return [r, g, b, s * (0.35 + 0.65 * clamp(day))];
}

// FXMaster's clouds on a scene (its effects: { id: { type, options } }), as the cloud shadows should follow them: the way
// they drift (`angle`, radians on the map), how fast (`speed` 0–1 as a wind) and whether they shadow themselves (`shadows`:
// then the map's cloud shadows give way to theirs, which lie under the clouds you see). null: none.
export function fxClouds(effects = {}) {
  const cloud = Object.values(effects ?? {}).find((e) => e?.type === 'clouds');
  if (!cloud) return null;
  const o = cloud.options ?? {}, num = (v, d) => (Number.isFinite(Number(v?.value ?? v)) ? Number(v?.value ?? v) : d);
  return { angle: (num(o.direction, 0) * Math.PI) / 180, speed: Math.min(1, Math.max(0, num(o.speed, 0.5))), shadows: (o.dropShadow?.value ?? o.dropShadow) === true };
}

// What it draws with, for warming ahead of the first frame (scene-shaders.mjs).
export const SKY_SHADER_SOURCES = Object.freeze([[VERT, FRAG]]);
