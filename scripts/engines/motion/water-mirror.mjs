// What still water shows from above. Someone on the bank or wading: a flipped, dimmed, slightly stretched copy of them running down the map from their feet, trembling with the water.
// Fires and lamps near it: a soft, broken column of their colour across the surface. The moon: a broken path of glitter. All of it cut to the water; rough water shows none of it.
// A dozen copies at most, nearest the middle of the view, the sprites used over; one mesh for all the light. Every screen has its own: nothing here is saved or shared.

import { nearestOfArea } from './river-sound.mjs';

export const MAX_MIRRORS = 12;
export const MAX_COLUMNS = 8;
const QUADS = MAX_COLUMNS + 1;
// How near the water something must be to show in it (squares).
export const MIRROR_REACH = 2, LAMP_REACH = 4;

const inPoly = (p, area) => nearestOfArea(p, area).d === 0;
const inAny = (p, areas) => areas.some((a) => inPoly(p, a));
const calmAt = (p, areas, rough) => areas.some((a) => inPoly(p, a) && !(a.holes ?? []).some((h) => inPoly(p, h))) && !inAny(p, rough);
const nearestWater = (p, areas) => { let best = Infinity; for (const a of areas) best = Math.min(best, nearestOfArea(p, a).d); return best; };
// How much of a line down the map lies on calm water, 0-1.
const wetDown = (x, y, len, areas, rough, samples = 6) => {
  let hit = 0;
  for (let i = 0; i < samples; i++) if (calmAt({ x, y: y + (len * (i + 0.5)) / samples }, areas, rough)) hit++;
  return hit / samples;
};

// Where a token's mirrored copy goes (pure). `x`, `y` its middle and `w`, `h` its size in px, `rotation` radians. null: its feet are more than 2 squares from calm water, or it stands in rough water.
// Else { id, x, y (the copy's middle), foot (y of the feet, where the copy starts), w, h (stretched), rotation, alpha, distance (px, feet to water), wet (0-1 how much of the copy lands on the water; none: nothing shows) }.
export function mirrorOf(token, areas = [], { grid = 100, rough = [], stretch = 1.12 } = {}) {
  if (!token || !areas.length) return null;
  const w = token.w ?? grid, h = token.h ?? grid, foot = { x: token.x, y: token.y + h / 2 };
  if (inAny(foot, rough) || inAny({ x: token.x, y: token.y }, rough)) return null;
  const distance = nearestWater(foot, areas);
  if (distance > MIRROR_REACH * grid) return null;
  const tall = h * stretch;
  return { id: token.id, x: token.x, y: foot.y + tall / 2, foot: foot.y, w, h: tall, rotation: -(Number(token.rotation) || 0), alpha: (token.alpha ?? 1) * 0.62 * (1 - 0.5 * (distance / (MIRROR_REACH * grid))), distance, wet: wetDown(token.x, foot.y, tall, areas, rough) };
}

// The copy's tremble now (pure): a slight lean and stretch, more with wind (0-1), each with its own `phase`.
export function mirrorWobble(time, phase = 0, wind = 0) {
  const w = Math.max(0, Math.min(1, Number(wind) || 0));
  return { skew: (0.012 + 0.03 * w) * Math.sin(time * 1.7 + phase) + (0.006 + 0.012 * w) * Math.sin(time * 4.3 + phase * 2.1), stretch: 1 + (0.01 + 0.03 * w) * Math.sin(time * 2.3 + phase * 1.7) };
}

// The nearest `limit` to the middle of the view, nearest first (pure).
export function nearestFirst(list, view, limit = MAX_MIRRORS) {
  if (!view) return list.slice(0, limit);
  const cx = view.x + view.w / 2, cy = view.y + view.h / 2, far = (o) => (o.x - cx) ** 2 + (o.y - cy) ** 2;
  return [...list].sort((a, b) => far(a) - far(b)).slice(0, limit);
}

// A colour as 0-1 red, green, blue (pure): a number 0xrrggbb, '#rrggbb', or warm firelight if neither.
export function colorOf(color) {
  // Foundry's own Color is a Number underneath.
  const n = typeof color === 'number' || color instanceof Number ? Number(color) : typeof color === 'string' && /^#?[0-9a-f]{6}$/i.test(color) ? parseInt(color.replace('#', ''), 16) : 0xffb066;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// The column a fire or lamp throws (pure). null: more than 4 squares from water. Else { x, y, len, width, color, strength 0-1, wet (0-1 how much of it lands on calm water) }. A lamp below the water throws nowhere: wet 0.
export function lampColumn(lamp, areas = [], { grid = 100, rough = [], sunny = false } = {}) {
  if (!lamp || !areas.length) return null;
  const distance = nearestWater(lamp, areas);
  if (distance > LAMP_REACH * grid) return null;
  const radius = Number(lamp.radius) || grid * 2, len = Math.min(grid * 9, Math.max(grid * 4, distance + radius * 1.1));
  return { x: lamp.x, y: lamp.y, len, width: Math.min(grid * 1.1, grid * 0.4 + radius * 0.08), color: colorOf(lamp.color), strength: (0.4 + 0.6 * (1 - distance / (LAMP_REACH * grid))) * (sunny ? 0.2 : 1), wet: wetDown(lamp.x, lamp.y, len, areas, rough) };
}

// The moon's path on the water (pure), from where it comes down on it to the bottom of the view. null: no moon, or none to see. Else { x, y, len, width, strength 0-1 }.
export function moonPath(moon, view, { grid = 100 } = {}) {
  const strength = Math.min(1, Number(moon?.strength) || 0);
  if (!moon || strength <= 0) return null;
  const y = view ? Math.max(moon.y, view.y - grid) : moon.y, end = view ? view.y + view.h + grid : moon.y + grid * 12;
  if (end <= y) return null;
  return { x: moon.x, y, len: end - y, width: grid * 2, strength };
}

const VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec4 aBand; attribute vec3 aTint;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vPos; varying vec4 vBand; varying vec3 vTint;
void main(){ vPos = aVertexPosition; vBand = aBand; vTint = aTint; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vPos;
varying vec4 vBand;                          // -1..1 across, 0-1 along, how strong, 0 a lamp's column and 1 the moon's path
varying vec3 vTint;
uniform float uTime, uGrid, uWind;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main(){
  vec2 p = vPos / uGrid;
  float u = vBand.x, v = vBand.y, a;
  if (vBand.w < 0.5) {
    // A column: wandering a little from side to side, in bars across that come and go, thinning away from the lamp.
    float side = u + (noise(vec2(p.y * 1.6, uTime * 0.5)) - 0.5) * (0.5 + uWind * 0.7);
    float bars = smoothstep(0.34, 0.66, noise(vec2(p.x * 2.0, p.y * 5.5 - uTime * 0.5)));
    a = (1.0 - smoothstep(0.0, 1.0, abs(side))) * smoothstep(0.0, 0.06, v) * pow(1.0 - v, 1.2) * (0.25 + 0.75 * bars);
  } else {
    // The moon's path: small bright flecks, thick down the middle and thin to the sides, none in places.
    float fleck = noise(vec2(p.x * 9.0, p.y * 15.0 + uTime * 0.4)) * 0.6 + noise(vec2(p.x * 4.0, p.y * 9.0 - uTime * 0.9)) * 0.5;
    float patches = smoothstep(0.3, 0.55, noise(vec2(p.x * 0.8, p.y * 1.3 - uTime * 0.1)));
    a = (1.0 - smoothstep(0.1, 1.0, abs(u))) * smoothstep(0.62, 0.78, fleck) * patches * smoothstep(0.0, 0.04, v) * (1.0 - smoothstep(0.96, 1.0, v));
  }
  a = clamp(a * vBand.z, 0.0, 1.0);
  // Light added to the water far more than covering it.
  gl_FragColor = vec4(vTint * a, a * 0.35);
}`;
export const WATER_MIRROR_SHADER = Object.freeze({ vert: VERT, frag: FRAG });

/**
 * The layer: water(areas (flat points, each with its `holes`), { rough: [flat points] }) where it shows, and where it does not; look({ tokens: [{ id, texture, x, y (its middle), w, h, rotation (radians), alpha }],
 * lamps: [{ x, y, color, radius }], moon: { x, y, strength } | null, sunny }); tick(seconds, { view { x, y, w, h }, wind 0-1 }); clear(). `root()` the container it goes in, `grid()` px a square (the scene's if left out).
 * Rough water inside calm water is cut out of the mask only when all its corners lie in it; rough water beside it needs nothing.
 */
export function createWaterMirror({ PIXI, root, grid: gridOf = () => globalThis.canvas?.grid?.size ?? 100 }) {
  let holder = null, layer = null, mask = null, mesh = null, uniforms = null, pos = null, band = null, tint = null;
  let areas = [], rough = [], grid = 100, box = null, tokens = [], lampsNow = [], moonNow = null, sunny = false, time = 0, refresh = 0, viewKey = '', lightKey = '', lightDirty = true;
  const sprites = [], shown = new Map(), cache = new Map();
  let copies = [];
  const make = () => {
    holder = new PIXI.Container(); holder.eventMode = 'none';
    layer = new PIXI.Container(); layer.eventMode = 'none';
    mask = new PIXI.Graphics();
    holder.addChild(layer); holder.addChild(mask); layer.mask = mask;
    pos = new Float32Array(QUADS * 8); band = new Float32Array(QUADS * 16); tint = new Float32Array(QUADS * 12);
    const index = new Uint16Array(QUADS * 6); for (let i = 0; i < QUADS; i++) index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    uniforms = { uTime: time, uGrid: grid, uWind: 0 };
    const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(pos, false), 2).addAttribute('aBand', new PIXI.Buffer(band, false), 4).addAttribute('aTint', new PIXI.Buffer(tint, false), 3).addIndex(index);
    mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, uniforms));
    mesh.eventMode = 'none'; mesh.visible = false;
    layer.addChild(mesh);
    root().addChild(holder);
    drawMask();
  };
  const ready = () => { if (!holder || holder.destroyed) { dropAll(); make(); } };
  const drawMask = () => {
    if (!mask) return;
    mask.clear(); mask.beginFill(0xffffff);
    for (const area of areas) {
      mask.drawPolygon(area);
      const cuts = [...(area.holes ?? []), ...rough.filter((r) => { for (let i = 0; i < r.length; i += 2) if (!inPoly({ x: r[i], y: r[i + 1] }, area)) return false; return true; })];
      for (const hole of cuts) { mask.beginHole(); mask.drawPolygon(hole); mask.endHole(); }
    }
    mask.endFill();
  };
  // What the tokens now show, working out again only those that have moved.
  const place = () => {
    const seen = new Set(), g = gridOf();
    copies = [];
    for (const t of tokens) {
      const key = `${t.x}|${t.y}|${t.w}|${t.h}|${t.rotation}|${t.alpha}`; seen.add(t.id);
      let was = cache.get(t.id);
      if (!was || was.key !== key) { was = { key, spot: mirrorOf(t, areas, { grid: g, rough }) }; cache.set(t.id, was); }
      if (was.spot && was.spot.wet > 0) copies.push({ ...was.spot, texture: t.texture, phase: hashPhase(t.id) });
    }
    for (const id of cache.keys()) if (!seen.has(id)) cache.delete(id);
    refresh = 0;
  };
  const hashPhase = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 628) / 100; };
  const quad = (i, { x, y, len, width }, color, strength, kind) => {
    pos.set([x - width, y, x + width, y, x + width, y + len, x - width, y + len], i * 8);
    band.set([-1, 0, strength, kind, 1, 0, strength, kind, 1, 1, strength, kind, -1, 1, strength, kind], i * 16);
    for (let k = 0; k < 4; k++) tint.set(color, (i * 4 + k) * 3);
  };
  const paintLight = (view) => {
    const g = gridOf(), columns = nearestFirst(lampsNow.map((l) => lampColumn(l, areas, { grid: g, rough, sunny })).filter((c) => c && c.wet > 0), view, MAX_COLUMNS);
    let i = 0;
    for (const c of columns) quad(i++, c, c.color, c.strength, 0);
    const path = sunny ? null : moonPath(moonNow, view, { grid: g });
    if (path) quad(i++, path, [0.82, 0.87, 0.98], path.strength * 0.9, 1);
    pos.fill(0, i * 8);
    for (const name of ['aVertexPosition', 'aBand', 'aTint']) mesh.geometry.getBuffer(name).update();
    mesh.visible = i > 0;
    lightDirty = false;
  };
  const dressSprites = (view) => {
    const pick = nearestFirst(copies, view, MAX_MIRRORS);
    shown.clear();
    pick.forEach((c, i) => {
      if (!c.texture?.valid) return;
      let s = sprites[i];
      if (!s || s.destroyed) { s = sprites[i] = new PIXI.Sprite(c.texture); s.anchor.set(0.5); s.eventMode = 'none'; s.tint = 0x5e6e78; layer.addChildAt(s, 0); }
      s.texture = c.texture; s.visible = true; s.rotation = c.rotation; s.alpha = c.alpha * (sunny ? 1 : 0.75);
      shown.set(s, c);
    });
    for (let i = 0; i < sprites.length; i++) if (sprites[i] && !shown.has(sprites[i])) sprites[i].visible = false;
    refresh = 0.25;
  };
  const dropAll = () => {
    try { if (layer) layer.mask = null; holder?.parent?.removeChild(holder); holder?.destroy({ children: true }); } catch { /* gone */ }
    holder = layer = mask = mesh = uniforms = pos = band = tint = null; sprites.length = 0; shown.clear();
  };
  return {
    water(list = [], { rough: bad = [] } = {}) {
      areas = list; rough = bad; cache.clear(); box = null; lightDirty = true;
      if (list.length) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const a of list) for (let i = 0; i < a.length; i += 2) { x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]); }
        box = { x: x0, y: y0, r: x1, b: y1 };
      }
      if (mask) drawMask();
      place();
    },
    look({ tokens: list = [], lamps = [], moon = null, sunny: day = false } = {}) {
      tokens = list; lampsNow = lamps; moonNow = moon; sunny = !!day;
      // Called as often as the tokens move: the lamps are only worked out again when they have changed.
      const key = `${sunny}|${moon ? `${moon.x},${moon.y},${moon.strength}` : ''}|${lamps.map((l) => `${l.x},${l.y},${Number(l.color) || l.color},${l.radius}`).join(';')}`;
      if (key !== lightKey) { lightKey = key; lightDirty = true; }
      place();
    },
    tick(seconds, { view = null, wind = 0 } = {}) {
      if (!areas.length || (!copies.length && !lampsNow.length && !moonNow)) { if (holder) holder.visible = false; return; }
      ready();
      const shows = !view || !box || (box.x < view.x + view.w && box.r > view.x && box.y < view.y + view.h && box.b > view.y);
      holder.visible = shows;
      if (!shows) return;
      const dt = Math.min(0.1, seconds); time += dt; grid = gridOf();
      uniforms.uTime = time; uniforms.uGrid = grid; uniforms.uWind = wind;
      // The moon's path runs to the bottom of the view, so it follows the view about.
      const key = view && moonNow && !sunny ? `${Math.round(view.y / grid)}|${Math.round((view.y + view.h) / grid)}` : '';
      if (lightDirty || key !== viewKey) { viewKey = key; paintLight(view); }
      refresh -= dt;
      if (refresh <= 0) dressSprites(view);
      for (const [s, c] of shown) {
        const w = mirrorWobble(time, c.phase, wind), tall = c.h * w.stretch;
        s.skew.x = w.skew;
        s.scale.set(c.w / Math.max(1, c.texture.width), -tall / Math.max(1, c.texture.height));
        // The lean swings about its middle: moved back so that it stays at their feet.
        s.position.set(c.x + Math.sin(w.skew) * (tall / 2), c.foot + tall / 2);
      }
    },
    clear() { dropAll(); areas = []; rough = []; box = null; tokens = []; lampsNow = []; moonNow = null; copies = []; cache.clear(); lightDirty = true; viewKey = ''; },
    get busy() { return !!box && (copies.length > 0 || lampsNow.length > 0 || !!moonNow); },
  };
}
