// What still water shows from above. Someone on the bank or wading: a flipped, dimmed, slightly stretched copy of them running out across the water from the nearest bank, trembling with the water.
// Fires and lamps near it: a soft, broken column of their colour across the surface. The moon: a broken path of glitter. All of it cut to the water; rough water shows none of it.
// A dozen copies at most, nearest the middle of the view, the sprites used over; one mesh for all the light. Every screen has its own: nothing here is saved or shared.

import { nearestOfArea } from './river-sound.mjs';

export const MAX_MIRRORS = 12;
export const MAX_COLUMNS = 8;
// Tiles have their own allowance, so a wood by the pond never crowds out the creatures. One bigger than this many squares is a map's overlay, not a thing standing by the water.
export const MAX_TILES = 16, BIGGEST_TILE = 12;
const QUADS = MAX_COLUMNS + 1;
// How near the water something must be to show in it (squares).
export const LAMP_REACH = 4;

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

// What a region's water is to a mirror (pure): `own` its Animater flags, `isWater` whether its floor is water. 'calm' mirrors and 'rough' does not; null is no water at all. A dripping region's pool is still water whatever the floor around it. A region can ask for no reflections.
export function waterStillness(own = {}, isWater = false) {
  if (!isWater && !own.drips) return null;
  return own.waterfall || own.sea || own.current === 'swift' || own.reflections === 'off' ? 'rough' : 'calm';
}

// What of a copy lands on calm water (pure): sampled across the token's whole width, so someone at the water's edge reflects from the part of them over it. { wet 0-1, down (px from the feet to the first water under any of them; the copy's length if none) }.
const COPY_COLUMNS = [-0.4, -0.2, 0, 0.2, 0.4], COPY_ROWS = 6;
const copyOnWater = (foot, way, width, tall, areas, rough) => {
  const at = (across, along) => ({ x: foot.x - way.y * across * width + way.x * along, y: foot.y + way.x * across * width + way.y * along });
  let hit = 0, down = tall;
  for (const across of COPY_COLUMNS) for (let row = 0; row < COPY_ROWS; row++) {
    const along = (tall * (row + 0.5)) / COPY_ROWS;
    if (!calmAt(at(across, along), areas, rough)) continue;
    hit++;
    // Where the water starts on this line, between this sample and the one before.
    if (along < down) { let dry = Math.max(0, along - tall / COPY_ROWS), wet = along; if (calmAt(at(across, 0), areas, rough)) wet = 0; else for (let i = 0; i < 6; i++) { const mid = (dry + wet) / 2; if (calmAt(at(across, mid), areas, rough)) wet = mid; else dry = mid; } down = Math.min(down, wet); }
  }
  return { wet: hit / (COPY_COLUMNS.length * COPY_ROWS), down };
};
// The ways a copy can fall: down the map, up it, and to either side. Each water it reaches shows its own copy.
export const MIRROR_WAYS = Object.freeze([{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }].map((w) => Object.freeze(w)));

// How a token is turned as Foundry draws it (pure, radians): its rotation, or none when Lock Rotation is on.
export const tokenTurn = (doc) => (doc?.lockRotation ? 0 : (Number(doc?.rotation) || 0) * Math.PI / 180);

// Ringed tokens as Foundry draws them (its dynamic ring, background and creature), each rendered once into its own picture and
// drawn again only when its art, ring or size changes. `renderer` the canvas's (or a function giving it). `of(token)`: { texture, x, y (its middle, canvas px), w, h } for a token
// whose ring is on, else null. `keep(ids)` lets go of the rest; `clear()` all. Pictures are at most `most` px a side.
export function createRingPictures({ PIXI, renderer, most = 512 }) {
  const held = new Map();
  const drop = (id) => { try { held.get(id)?.texture?.destroy(true); } catch { /* gone */ } held.delete(id); };
  return {
    of(token) {
      const mesh = token?.mesh, doc = token?.document, draw = typeof renderer === 'function' ? renderer() : renderer;
      if (!doc?.ring?.enabled || !mesh || mesh.destroyed || !mesh.texture?.valid || !draw) return null;
      // (Its place worked out afresh first: one moved or resized since the last frame drawn would land off its picture.)
      if (mesh.parent) mesh.updateTransform?.();
      const b = mesh.getLocalBounds(), lt = mesh.localTransform;
      if (!(b.width > 0 && b.height > 0) || !lt) return null;
      const sx = Math.hypot(lt.a, lt.b), sy = Math.hypot(lt.c, lt.d), w = b.width * sx, h = b.height * sy;
      const mid = lt.apply(new PIXI.Point(b.x + b.width / 2, b.y + b.height / 2));
      const key = `${mesh.texture.baseTexture?.uid}|${JSON.stringify(doc.ring)}|${Math.round(w)}|${Math.round(h)}|${mesh.tint}`;
      let got = held.get(token.id);
      if (!got || got.key !== key) {
        drop(token.id);
        const k = Math.min(1, most / Math.max(w, h)), pw = Math.max(1, Math.ceil(w * k)), ph = Math.max(1, Math.ceil(h * k));
        const texture = PIXI.RenderTexture.create({ width: pw, height: ph });
        // The token unturned and in its own place: from where it is drawn now back to its own corner, at the picture's size.
        const m =mesh.worldTransform.clone().invert(); m.translate(-b.x, -b.y); m.scale(pw / b.width, ph / b.height);
        try { draw.render(mesh, { renderTexture: texture, transform: m, clear: true, skipUpdateTransform: true }); }
        catch { texture.destroy(true); return null; }
        got = { key, texture }; held.set(token.id, got);
      }
      return { texture: got.texture, x: mid.x, y: mid.y, w, h };
    },
    keep(ids) { for (const id of [...held.keys()]) if (!ids.has(id)) drop(id); },
    clear() { for (const id of [...held.keys()]) drop(id); },
  };
}

// Where a token's mirrored copy goes one way (pure; `way` down the map unless given). `x`, `y` its middle and `w`, `h` its size in px, `rotation` radians. null: it stands in rough water, or no water lies within its own length of it, so a big creature reflects from further off than a small one.
// Else { id, x, y (the copy's middle), footX, foot (where the copy starts, on the token's side facing the water), way { x, y } the way it falls, w, h (stretched), rotation, alpha, distance (px, its edge to the nearest water), down (px, its edge to the water along that way), wet (0-1 how much of the copy lands on the water; none: nothing shows) }.
// The copy runs from that edge and the water cuts it, so the further from the shore, the less of it shows: the head alone, then nothing; and it fades to nothing as it goes.
// `blocked(from, to)`: whether a wall stands between two places; one between it and the water it would land on hides it. From just off its middle, so a tile standing on a wall's line still shows.
// `decks`: what stands over the water (a dock, a bridge): nothing shows on them, and standing on one is not wading.
export function mirrorOf(token, areas = [], { grid = 100, rough = [], decks = [], stretch = 1.12, blocked = null, way = MIRROR_WAYS[0] } = {}) {
  if (!token || !areas.length) return null;
  const w = token.w ?? grid, h = token.h ?? grid, centre = { x: token.x, y: token.y };
  // How far its edge lies from its middle that way: a tall token's foot is further than a wide one's side.
  const reach = (Math.abs(way.x) * w + Math.abs(way.y) * h) / 2, foot = { x: centre.x + way.x * reach, y: centre.y + way.y * reach };
  if (inAny(foot, rough) || inAny(centre, rough)) return null;
  const tall = h * stretch, distance = nearestWater(foot, areas);
  if (distance > tall + w / 2) return null;
  const { wet, down } = copyOnWater(foot, way, w, tall, areas, decks.length ? [...rough, ...decks] : rough), showing = Math.max(0, 1 - down / tall);
  if (wet > 0 && blocked?.({ x: centre.x + way.x, y: centre.y + way.y }, { x: foot.x + way.x * down, y: foot.y + way.y * down })) return null;
  // The picture's top falls away from the token; a copy running down the map needs no turn.
  const turn = Math.atan2(way.y, way.x) - Math.PI / 2;
  return { id: token.id, x: foot.x + way.x * tall / 2, y: foot.y + way.y * tall / 2, footX: foot.x, foot: foot.y, way: { x: way.x, y: way.y }, w, h: tall, rotation: turn - (Number(token.rotation) || 0), alpha: (token.alpha ?? 1) * 0.62 * Math.min(1, showing * 1.6) * Math.min(1, wet * 2.5), distance, down, wet };
}

// Every copy a token shows (pure): one into each water it reaches, down, up or to a side, so on a bridge both sides show
// it, each fading with its own distance. Standing in open water (wading; `token.dry` not set: no bridge or dock under it)
// only the copy down the map, as the table sees it from below. Each copy carries `dir`, which way it is (0-3).
export function mirrorsOf(token, areas = [], options = {}) {
  if (!token || !areas.length) return [];
  const centre = { x: token.x, y: token.y }, wading = token.dry !== true && !inAny(centre, options.decks ?? []) && areas.some((a) => inPoly(centre, a) && !(a.holes ?? []).some((h) => inPoly(centre, h)));
  const out = [];
  MIRROR_WAYS.forEach((way, dir) => {
    if (wading && dir !== 0) return;
    const spot = mirrorOf(token, areas, { ...options, way });
    if (spot && spot.wet > 0) out.push({ ...spot, dir });
  });
  return out;
}

// The tiles that show in the water (pure): `tiles` as tokens are, with their `texture`; a hidden one, one the size of a map, or one with none of it landing on calm water shows nothing. Tiles are not stretched.
export function tileMirrors(tiles = [], areas = [], { grid = 100, rough = [], decks = [], blocked = null } = {}) {
  const out = [];
  for (const tile of tiles) {
    if (tile.hidden || Math.max(tile.w ?? 0, tile.h ?? 0) > BIGGEST_TILE * grid) continue;
    for (const spot of mirrorsOf({ ...tile, dry: true }, areas, { grid, rough, decks, stretch: 1, blocked })) out.push({ ...spot, texture: tile.texture });
  }
  return out;
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

// The column a fire or lamp throws (pure). null: more than 4 squares from water. Else { x, y, len, width, color, strength 0-1, wet (0-1 how much of it lands on calm water) }. A lamp below the water throws nowhere, nor one with a wall (`blocked(from, to)`) between it and the water: wet 0.
export function lampColumn(lamp, areas = [], { grid = 100, rough = [], sunny = false, blocked = null } = {}) {
  if (!lamp || !areas.length) return null;
  const distance = nearestWater(lamp, areas);
  if (distance > LAMP_REACH * grid) return null;
  const radius = Number(lamp.radius) || grid * 2, len = Math.min(grid * 9, Math.max(grid * 4, distance + radius * 1.1));
  let wet = wetDown(lamp.x, lamp.y, len, areas, rough);
  if (wet > 0 && blocked) { let along = 0; for (let i = 0; i < 6; i++) { along = (len * (i + 0.5)) / 6; if (calmAt({ x: lamp.x, y: lamp.y + along }, areas, rough)) break; } if (blocked({ x: lamp.x, y: lamp.y }, { x: lamp.x, y: lamp.y + along })) wet = 0; }
  return { x: lamp.x, y: lamp.y, len, width: Math.min(grid * 1.1, grid * 0.4 + radius * 0.08), color: colorOf(lamp.color), strength: (0.4 + 0.6 * (1 - distance / (LAMP_REACH * grid))) * (sunny ? 0.2 : 1), wet };
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
 * lamps: [{ x, y, color, radius }], moon: { x, y, strength } | null, sunny }); tick(seconds, { view { x, y, w, h }, wind 0-1 }); walls() when a wall or door has changed; clear(). `root()` the container it goes in, `grid()` px a square (the scene's if left out), `blocked(from, to)` whether a wall stands between two places.
 * Rough water inside calm water is cut out of the mask only when all its corners lie in it; rough water beside it needs nothing.
 */
export function createWaterMirror({ PIXI, root, grid: gridOf = () => globalThis.canvas?.grid?.size ?? 100, blocked = null }) {
  let holder = null, layer = null, mask = null, mesh = null, uniforms = null, pos = null, band = null, tint = null;
  let areas = [], rough = [], decks = [], grid = 100, box = null, tokens = [], lampsNow = [], moonNow = null, sunny = false, time = 0, refresh = 0, viewKey = '', lightKey = '', lightDirty = true;
  // Each copy drawn, by token and way (`id:dir`): its sprite, what it shows, and how far it has faded in, so a copy never pops in or out.
  const live = new Map(), spare = [], cache = new Map();
  let copies = [], tilesNow = [], tileCopies = [];
  // Tiles stand still, so this is only worked out when they or the water change.
  const placeTiles = () => { tileCopies = tileMirrors(tilesNow, areas, { grid: gridOf(), rough, decks, blocked }).map((c) => ({ ...c, key: `${c.id}:${c.dir}`, phase: hashPhase(c.id) })); refresh = 0; };
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
      const cuts = [...(area.holes ?? []), ...[...rough, ...decks].filter((r) => { for (let i = 0; i < r.length; i += 2) if (!inPoly({ x: r[i], y: r[i + 1] }, area)) return false; return true; })];
      for (const hole of cuts) { mask.beginHole(); mask.drawPolygon(hole); mask.endHole(); }
    }
    mask.endFill();
  };
  // What the tokens now show, working out again only those that have moved.
  const place = () => {
    const seen = new Set(), g = gridOf();
    copies = [];
    for (const t of tokens) {
      const key = `${t.x}|${t.y}|${t.w}|${t.h}|${t.rotation}|${t.alpha}|${t.dry === true}`; seen.add(t.id);
      let was = cache.get(t.id);
      if (!was || was.key !== key) { was = { key, spots: mirrorsOf(t, areas, { grid: g, rough, decks, blocked }) }; cache.set(t.id, was); }
      // (`live`: where the token is drawn this very frame, its position object, so the copy keeps up as it glides between these looks.)
      for (const spot of was.spots) copies.push({ ...spot, key: `${t.id}:${spot.dir}`, texture: t.texture, phase: hashPhase(t.id) + spot.dir, live: t.live ?? null, fromX: t.liveX ?? t.x, fromY: t.liveY ?? t.y });
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
    const g = gridOf(), columns = nearestFirst(lampsNow.map((l) => lampColumn(l, areas, { grid: g, rough, sunny, blocked })).filter((c) => c && c.wet > 0), view, MAX_COLUMNS);
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
    const pick = [...nearestFirst(copies, view, MAX_MIRRORS), ...nearestFirst(tileCopies, view, MAX_TILES)];
    for (const entry of live.values()) entry.want = false;
    for (const c of pick) {
      if (!c.texture?.valid) continue;
      let entry = live.get(c.key);
      if (!entry) {
        let s = spare.pop();
        if (!s || s.destroyed) { s = new PIXI.Sprite(c.texture); s.anchor.set(0.5); s.eventMode = 'none'; s.tint = 0x5e6e78; layer.addChildAt(s, 0); }
        entry = { s, a: 0 }; live.set(c.key, entry);
      }
      entry.c = c; entry.want = true; entry.s.texture = c.texture; entry.s.rotation = c.rotation; entry.s.visible = true;
    }
    refresh = 0.25;
  };
  const dropAll = () => {
    try { if (layer) layer.mask = null; holder?.parent?.removeChild(holder); holder?.destroy({ children: true }); } catch { /* gone */ }
    holder = layer = mask = mesh = uniforms = pos = band = tint = null; live.clear(); spare.length = 0;
  };
  return {
    water(list = [], { rough: bad = [], decks: over = [] } = {}) {
      areas = list; rough = bad; decks = over; cache.clear(); box = null; lightDirty = true;
      if (list.length) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const a of list) for (let i = 0; i < a.length; i += 2) { x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]); }
        box = { x: x0, y: y0, r: x1, b: y1 };
      }
      if (mask) drawMask();
      place(); placeTiles();
    },
    // What stands by the water besides the creatures: [{ id, texture, x, y (its middle), w, h, rotation (radians), alpha, hidden }].
    tiles(list = []) { tilesNow = list; placeTiles(); },
    // A wall or door changed: what it hid or showed, though nothing has moved.
    walls() { cache.clear(); lightDirty = true; place(); placeTiles(); },
    look({ tokens: list = [], lamps = [], moon = null, sunny: day = false } = {}) {
      tokens = list; lampsNow = lamps; moonNow = moon; sunny = !!day;
      // Called as often as the tokens move: the lamps are only worked out again when they have changed.
      const key = `${sunny}|${moon ? `${moon.x},${moon.y},${moon.strength}` : ''}|${lamps.map((l) => `${l.x},${l.y},${Number(l.color) || l.color},${l.radius}`).join(';')}`;
      if (key !== lightKey) { lightKey = key; lightDirty = true; }
      place();
    },
    tick(seconds, { view = null, wind = 0 } = {}) {
      if (!areas.length || (!copies.length && !tileCopies.length && !live.size && !lampsNow.length && !moonNow)) { if (holder) holder.visible = false; return; }
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
      // Each copy eases toward how strong it should be: in as its water comes within reach, out as it goes, about half a second either way.
      const ease = Math.min(1, dt * 6);
      for (const [key, entry] of live) {
        const { s, c } = entry;
        entry.a += ((entry.want ? c.alpha * (sunny ? 1 : 0.75) : 0) - entry.a) * ease;
        if (!entry.want && entry.a < 0.004) { s.visible = false; spare.push(s); live.delete(key); continue; }
        s.alpha = entry.a;
        const w = mirrorWobble(time, c.phase, wind), tall = c.h * w.stretch;
        s.skew.x = w.skew;
        s.scale.set(c.w / Math.max(1, c.texture.width), -tall / Math.max(1, c.texture.height));
        // The lean swings about its middle: moved back so that it stays at their feet.
        const lean = Math.sin(w.skew) * (tall / 2), way = c.way ?? { x: 0, y: 1 };
        const dx = c.live ? (Number(c.live.x) || 0) - c.fromX : 0, dy = c.live ? (Number(c.live.y) || 0) - c.fromY : 0;
        s.position.set(c.footX + dx + way.x * tall / 2 + way.y * lean, c.foot + dy + way.y * tall / 2 - way.x * lean);
      }
    },
    clear() { dropAll(); areas = []; rough = []; decks = []; box = null; tokens = []; lampsNow = []; moonNow = null; copies = []; tilesNow = []; tileCopies = []; cache.clear(); lightDirty = true; viewKey = ''; },
    // Still drawn with nothing left to show counts too: the next tick is what clears it.
    get busy() { return !!box && (copies.length > 0 || tileCopies.length > 0 || live.size > 0 || lampsNow.length > 0 || !!moonNow || holder?.visible === true); },
  };
}

// What it draws with, for warming ahead of the first frame (scene-shaders.mjs).
export const MIRROR_SHADER_SOURCES = Object.freeze([[VERT, FRAG]]);
