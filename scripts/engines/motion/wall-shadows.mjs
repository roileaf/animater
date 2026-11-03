// Walls in the sun (the "Walls cast shadows in sunlight" setting): each wall that stops light throws its shadow on the
// floor away from the sun (sun.mjs), as long as its height and the sun's make it. Foundry's own lights already stop at
// walls; the sun had nothing. The shadows are baked once into one soft picture under the creatures and kept until the
// sun, the walls or the scene change, so a scene in daylight costs one sprite a frame.

import { createSilhouettes, silhouetteScale, SILHOUETTE_SIZE } from './flier-silhouette.mjs';

// The longest a wall's shadow grows (squares), with the sun on the horizon: past it, it is cut.
export const WALL_SHADOW_CAP = 12;
// The picture is drawn at this share of the scene's size: soft by nature, and cheap.
const RESOLUTION = 0.25;
// How soft its edges are (blur at the picture's size).
const SOFTNESS = 2;
// The largest picture made (pixels a side).
const MAX_TEXTURE = 4096;

// How much of the sun a wall stops: its light restriction (Foundry's: 0 none, 10 limited, 20 normal, 30 proximity,
// 40 distance), a window or foliage half; an open door none.
export function wallShadowStrength(wall = {}) {
  if (Number(wall.door) > 0 && Number(wall.ds) === 1) return 0;
  const light = Number(wall.light) || 0;
  return light >= 20 && light < 30 ? 1 : light > 0 ? 0.5 : 0;
}

// Where a wall stands for its shadow, in squares up from the level's floor: { top, bottom } (null where nothing says:
// the world's "Wall height", from the floor). From its `flags`: the Wall Height module's top and bottom first, else its
// own (Wall configuration → Animater shadow: flags.animater.shadowTop / shadowBottom); without a top, the level's
// ceiling. All in scene units: `floor` the level's floor, `ceiling` its top (null none), `per` scene units a square.
export function wallSpan(flags = {}, { floor = 0, per = 1, ceiling = null } = {}) {
  const given = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const up = (v) => (Number(v) - (Number(floor) || 0)) / (Number(per) || 1);
  const module = flags?.['wall-height'] ?? {}, own = flags?.animater ?? {};
  const top = given(module.top) ? module.top : given(own.shadowTop) ? own.shadowTop : given(ceiling) && Number(ceiling) > (Number(floor) || 0) ? ceiling : null;
  const bottom = given(module.bottom) ? module.bottom : given(own.shadowBottom) ? own.shadowBottom : null;
  return { top: top === null ? null : up(top), bottom: bottom === null ? null : up(bottom) };
}

// How far (squares) a wall `height` squares tall throws its shadow with the sun `sunHeight` degrees up.
export function wallShadowReach(height, sunHeight) {
  const up = Math.max(0, Math.min(89.9, Number(sunHeight) || 0)) * Math.PI / 180;
  return Math.min(WALL_SHADOW_CAP, Math.max(0, Number(height) || 0) / Math.max(1e-6, Math.tan(up)));
}

// Each wall's shadow: { points (a quadrilateral, flat x, y pairs), alpha, top, bottom (its height and where it starts,
// squares) }. `walls`: [{ c: [x1, y1, x2, y2], light, door, ds, top?, bottom? (its own, in squares up from the floor:
// Wall Height's, a level's) }]; `sun` sun.mjs's ({ angle, height, strength }, null none); `grid` the square in pixels;
// `height` how tall a wall stands (squares) when it gives no top of its own. A wall raised off the floor (a rail, a
// high window) throws its shadow from its bottom's to its top's, lit beside it.
export function wallShadowQuads({ walls = [], sun = null, grid = 100, height = 2 } = {}) {
  if (!sun || !(Number(sun.strength) > 0)) return [];
  const away = ((Number(sun.angle) || 0) + 180) * Math.PI / 180, dx = Math.cos(away), dy = Math.sin(away);
  const given = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const out = [];
  for (const wall of walls) {
    const alpha = wallShadowStrength(wall), c = wall?.c;
    if (!(alpha > 0) || !Array.isArray(c) || c.length < 4) continue;
    const bottom = given(wall.bottom) ? Math.max(0, Number(wall.bottom)) : 0;
    const top = given(wall.top) && Number(wall.top) > 0 ? Number(wall.top) : bottom + height;
    if (!(top > bottom)) continue;
    const near = wallShadowReach(bottom, sun.height) * grid, far = wallShadowReach(top, sun.height) * grid;
    if (!(far - near > 0.5)) continue;
    const [ax, ay, bx, by] = c.map(Number);
    out.push({ points: [ax + dx * near, ay + dy * near, bx + dx * near, by + dy * near, bx + dx * far, by + dy * far, ax + dx * far, ay + dy * far], alpha, top, bottom, c: [ax, ay, bx, by] });
  }
  return out;
}

// How deep in walls' shadow a point `elevation` squares up stands (the strongest covering it, 0 none): each wall
// (wallShadowQuads's, with its line `c`) throws a shadow at that height as far as its part above it reaches, so a
// window sill is shaded by a wall taller than it standing between it and the sun. `skip`: a wall's line to leave out
// (the window's own).
export function shadedAbove(point, quads = [], { elevation = 0, sun = null, grid = 100, skip = null } = {}) {
  if (!sun) return 0;
  const away = ((Number(sun.angle) || 0) + 180) * Math.PI / 180, dx = Math.cos(away), dy = Math.sin(away), e = Math.max(0, Number(elevation) || 0);
  let deepest = 0;
  for (const q of quads) {
    const c = q?.c;
    if (!(q.alpha > deepest) || !(q.top > e) || !Array.isArray(c)) continue;
    if (skip && c.every((v, i) => Math.abs(v - skip[i]) < 0.5)) continue;
    const near = wallShadowReach(Math.max(0, (q.bottom ?? 0) - e), sun.height) * grid, far = wallShadowReach(q.top - e, sun.height) * grid;
    if (!(far - near > 0.5)) continue;
    const [ax, ay, bx, by] = c;
    if (inside(point, [ax + dx * near, ay + dy * near, bx + dx * near, by + dy * near, bx + dx * far, by + dy * far, ax + dx * far, ay + dy * far])) deepest = q.alpha;
  }
  return deepest;
}

// Light through windows and open doors (the "Light through windows" setting): the sun, or the moon, shining through an
// opening lands on the floor beyond it, away from the light, from where its sill's light reaches to where its head's
// does. It shows only under a roof (outside, that floor is lit already). The longest a shaft grows (squares):
export const WINDOW_SHAFT_CAP = 8;
// A wall's opening the light passes, squares up from the floor ({ bottom, top, alpha }), or null: a window (light
// restriction proximity or distance, Foundry's window) from a 3 ft sill to a 7 ft head, glass taking some; an open
// door from the floor to 7 ft, whole. Real sizes, whatever the wall's height (a level's 20 ft ceiling made 17 ft
// windows): `foot` is a foot in squares (a 5 ft square: 0.2). Never past the wall's own top. The wall's own `kind`
// (Animater's Window on the wall: WINDOW_KINDS) says what fills it, on any wall, a solid one too (shutters drawn as a
// wall): glass, open (an empty frame), curtained (cloth letting a dim, spread light through) or shuttered (slats letting
// it through in bands); it is returned as `kind` (an open door 'open', Foundry's window 'glass').
export const WINDOW_KINDS = { glass: 0.8, open: 1, curtained: 0.4, shuttered: 0.55 };
export function windowOpening(wall = {}, height = 2, foot = 0.2) {
  const given = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const bottom = given(wall.bottom) ? Math.max(0, Number(wall.bottom)) : 0;
  const top = given(wall.top) && Number(wall.top) > bottom ? Number(wall.top) : bottom + height, ft = Number(foot) > 0 ? Number(foot) : 0.2;
  const upTo = (feet) => Math.min(top, bottom + feet * ft);
  if (Number(wall.door) > 0) return Number(wall.ds) === 1 ? { bottom, top: upTo(7), alpha: 1, kind: 'open' } : null;
  // A window: Foundry's Window (light proximity or distance), or glass drawn as a wall that lets the light through
  // freely (none) but stops movement; or any wall given a kind.
  const light = Number(wall.light) || 0, glass = light === 0 && Number(wall.move) > 0, kind = WINDOW_KINDS[wall.kind] ? wall.kind : null;
  return (kind || light >= 30 || glass) && upTo(7) > upTo(3) ? { bottom: upTo(3), top: upTo(7), alpha: WINDOW_KINDS[kind ?? 'glass'], kind: kind ?? 'glass' } : null;
}
// Each opening's patch of light: { points (a quadrilateral, flat x, y pairs; its first two points along the near
// edge), alpha }. As wallShadowQuads, for the same walls, sun and height. `indoors` the roofs: an opening whose sunward
// side is under one too (a door between two rooms) lets no daylight through. `shade` the walls' shadows
// (wallShadowQuads's): an opening another wall taller than it shades from the sun lets that much less through.
export function windowShafts({ walls = [], sun = null, grid = 100, height = 2, indoors = [], foot = 0.2, shade = [] } = {}) {
  if (!sun || !(Number(sun.strength) > 0)) return [];
  const away = ((Number(sun.angle) || 0) + 180) * Math.PI / 180, dx = Math.cos(away), dy = Math.sin(away);
  const out = [];
  for (const wall of walls) {
    const open = windowOpening(wall, height, foot), c = wall?.c;
    if (!open || !Array.isArray(c) || c.length < 4) continue;
    // From the opening itself (seen from above the light streams in from the window), out to where its head's light
    // lands: a high sill's gap below it would leave the patch floating, never reading as the window's.
    const near = 0, far = Math.min(WINDOW_SHAFT_CAP, wallShadowReach(open.top, sun.height)) * grid;
    if (!(far - near > grid * 0.1)) continue;
    const [ax, ay, bx, by] = c.map(Number);
    const sunward = { x: (ax + bx) / 2 - dx * grid * 0.5, y: (ay + by) / 2 - dy * grid * 0.5 };
    if (indoors.some((p) => inside(sunward, p))) continue;
    // The sun on the opening: just outside it, halfway up it.
    const sill = { x: (ax + bx) / 2 - dx * grid * 0.15, y: (ay + by) / 2 - dy * grid * 0.15 };
    const alpha = open.alpha * (1 - shadedAbove(sill, shade, { elevation: (open.bottom + open.top) / 2, sun, grid, skip: [ax, ay, bx, by] }));
    if (!(alpha > 0.05)) continue;
    out.push({ points: [ax + dx * near, ay + dy * near, bx + dx * near, by + dy * near, bx + dx * far, by + dy * far, ax + dx * far, ay + dy * far], alpha });
  }
  return out;
}

// Warm light from windows at night: an opening between a lit room and the open air spills that room's light onto the
// ground outside, fanning out from it. Each { points (a quadrilateral, flat x, y pairs; its first two points along the
// opening), alpha, color (0xrrggbb, its brightest light's, null for warm lamplight), from (the opening's middle), up (its
// middle's height, squares), reach (px), lamp ({ x, y }: the light inside lighting it most), room (its polygon), kind (windowOpening's), slats (bands of light through shutters, 0 none),
// shadow (how dark a creature's shadow in it is: a curtain's spread light throws only a faint one) }. A curtain's glow
// is dim, short and wide. `indoors` the rooms (the regions
// that keep the weather out); `lights` the lights burning ({ x, y, radius px, color }): one inside the room, reaching the
// opening, lights it, the nearer the brighter. A door between two rooms, or a window with the open air on both sides,
// spills nothing.
export function windowGlows({ walls = [], indoors = [], lights = [], grid = 100, height = 2, foot = 0.2 } = {}) {
  const out = [];
  for (const wall of walls) {
    const open = windowOpening(wall, height, foot), c = wall?.c;
    if (!open || !Array.isArray(c) || c.length < 4) continue;
    const [ax, ay, bx, by] = c.map(Number), len = Math.hypot(bx - ax, by - ay);
    if (!(len > 0)) continue;
    const ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux, mid = { x: (ax + bx) / 2, y: (ay + by) / 2 };
    // Which side is the room: a step either way from the opening.
    const step = grid * 0.3, sideA = { x: mid.x + nx * step, y: mid.y + ny * step }, sideB = { x: mid.x - nx * step, y: mid.y - ny * step };
    const roomA = indoors.find((poly) => inside(sideA, poly)), roomB = indoors.find((poly) => inside(sideB, poly));
    if (!roomA === !roomB) continue;
    const room = roomA ?? roomB, away = roomA ? -1 : 1;
    // How brightly the room is lit at the opening: its brightest light that reaches it.
    let best = 0, color = null, lamp = null;
    for (const l of lights) {
      const r = Number(l?.radius) || 0;
      if (!(r > 0) || !inside(l, room)) continue;
      const lit = 1 - Math.hypot(l.x - mid.x, l.y - mid.y) / r;
      if (lit > best) { best = lit; color = Number.isFinite(l.color) ? l.color : null; lamp = { x: l.x, y: l.y }; }
    }
    if (!(best > 0.05)) continue;
    const strength = Math.min(1, best * 1.6), curtained = open.kind === 'curtained';
    const reach = grid * (1 + 2 * strength) * (curtained ? 0.6 : 1), spread = reach * (curtained ? 0.7 : 0.35);
    const ox = nx * away * reach, oy = ny * away * reach;
    out.push({ points: [ax, ay, bx, by, bx + ox + ux * spread, by + oy + uy * spread, ax + ox - ux * spread, ay + oy - uy * spread], alpha: open.alpha * strength, color,
      from: mid, up: (open.bottom + open.top) / 2, reach, kind: open.kind, lamp, room,
      slats: open.kind === 'shuttered' ? Math.max(3, Math.round(reach / (grid * 0.3))) : 0, shadow: curtained ? 0.3 : open.kind === 'shuttered' ? 0.8 : 1 });
  }
  return out;
}

// The creatures' shadows in the window glows: the light out of a window is mostly its lamp's (the light inside lighting
// it most), coming straight through the opening, so a creature in its way, outside in the glow or inside between the
// lamp and the window, throws a hard shadow away from the lamp (LAMP_SHARE of the darkness), out over the glow. The
// rest is the room's light lit up around it, the window a broad light: a softer shadow cast from WINDOW_SAMPLES points
// across the opening, each carrying its share, only for a creature standing in the glow. Where all are hidden (straight
// behind a creature) it is whole; toward the sides, where the window's edges still show past it, it fades. Shorter only
// for a creature shorter than the opening's middle is high (the light then passes over it), its tip where its top's ray
// meets the ground. A creature holding the lamp (it within its square) casts none from it. `creatures`: [{ x, y, r (px,
// its body's radius), half (px, half its square; r / 0.64 when not given), height (squares), art (its token's art,
// { texture, flipX }: its shadow is drawn in its shape) }]. Returns [{ points (flat
// x, y pairs: the two sides at the creature, then their far ends), body: { x, y, r (its token's round) }, depth (its
// share of the glow's `shadow`), hard (the lamp's: barely fading), art }], added together where they overlap.
export const WINDOW_SAMPLES = 4;
export const LAMP_SHARE = 0.7;
export function glowShadows(glows = [], creatures = []) {
  const out = [];
  // A wedge from the light at `L` past the creature, `far` from the light at most.
  const wedge = (c, L, far, lh, depth, hard = false) => {
    const r = Number(c.r) || 0, hc = Number(c.height) || 1, d = Math.hypot(c.x - L.x, c.y - L.y);
    if (d <= r * 1.05) return;
    const reach = hc >= lh ? far : Math.min(far, (d * lh) / (lh - hc));
    if (reach <= d) return;
    // Where the light's rays graze the creature's sides.
    const back = Math.atan2(L.y - c.y, L.x - c.x), turn = Math.acos(r / d), side = [];
    for (const sgn of [1, -1]) {
      const tx = c.x + r * Math.cos(back + sgn * turn), ty = c.y + r * Math.sin(back + sgn * turn), td = Math.hypot(tx - L.x, ty - L.y);
      side.push([tx, ty, L.x + ((tx - L.x) / td) * reach, L.y + ((ty - L.y) / td) * reach]);
    }
    out.push({ points: [side[0][0], side[0][1], side[1][0], side[1][1], side[1][2], side[1][3], side[0][2], side[0][3]], body: { x: c.x, y: c.y, r: (Number(c.half) || r / 0.64) * 0.95 }, depth, hard, art: c.art ?? null });
  };
  const live = creatures.filter((c) => Number(c?.r) > 0);
  // The window's own soft fill, for the creatures standing in its glow.
  const lamps = new Map();
  for (const glow of glows) {
    if (!glow?.from || !Array.isArray(glow.points)) continue;
    const [ax, ay, bx, by] = glow.points, lh = Number(glow.up) || 1, shadow = Number.isFinite(glow.shadow) ? glow.shadow : 1;
    const fill = glow.lamp ? 1 - LAMP_SHARE : 1;
    for (const c of live) {
      // One in its shape takes its lamp's shadow whole: the fill in its shape would be ghosts of it at other angles.
      if (!inside(c, glow.points) || (c.art?.texture && glow.lamp)) continue;
      for (let i = 0; i < WINDOW_SAMPLES; i++) {
        const f = (i + 0.5) / WINDOW_SAMPLES;
        wedge(c, { x: ax + (bx - ax) * f, y: ay + (by - ay) * f }, (Number(glow.reach) || 0) * 1.25, lh, (shadow * fill) / WINDOW_SAMPLES);
      }
    }
    // Each lamp once, however many windows it lights: as far as its furthest glow, as dark as its darkest.
    if (glow.lamp) {
      const key = `${glow.lamp.x},${glow.lamp.y}`, far = Math.hypot(glow.from.x - glow.lamp.x, glow.from.y - glow.lamp.y) + (Number(glow.reach) || 0) * 1.25;
      const had = lamps.get(key);
      lamps.set(key, { at: glow.lamp, far: Math.max(far, had?.far ?? 0), lh: Math.max(lh, had?.lh ?? 0), shadow: Math.max(shadow, had?.shadow ?? 0),
        rooms: [...(had?.rooms ?? []), glow.room].filter(Boolean), glows: [...(had?.glows ?? []), glow.points] });
    }
  }
  // The lamps' hard shadows, for every creature in their way (not the one holding it): in the lamp's own room or
  // standing in one of its glows (a wall between keeps its light off the others).
  for (const lamp of lamps.values()) {
    for (const c of live) {
      const half = Number(c.half) || Number(c.r) / 0.64;
      if (Math.abs(lamp.at.x - c.x) < half && Math.abs(lamp.at.y - c.y) < half) continue;
      if (Math.hypot(c.x - lamp.at.x, c.y - lamp.at.y) >= lamp.far) continue;
      if (lamp.rooms.length && !lamp.rooms.some((room) => inside(c, room)) && !lamp.glows.some((g) => inside(c, g))) continue;
      wedge(c, lamp.at, lamp.far, lamp.lh, lamp.shadow * (c.art?.texture ? 1 : LAMP_SHARE), true);
    }
  }
  return out;
}

// The glow, less what the creatures in it keep from the ground (their shadows).
const GLOW_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uGlow, uShade;
uniform float uAlpha;
void main(){ gl_FragColor = texture2D(uGlow, vUv) * (1.0 - texture2D(uShade, vUv).a) * uAlpha; }`;

// Lightning through the windows: a flash outside lights each room only through its openings, a patch fanning in from
// each window or open door onto the floor (the sky's light comes in steeply: a short reach). Each { points (a
// quadrilateral, flat x, y pairs; its first two points along the opening), alpha }. As windowGlows, for the same walls
// and rooms, the other way round: an opening between two rooms, or with the open air on both sides, lets in nothing.
export function windowFlashes({ walls = [], indoors = [], grid = 100, height = 2, foot = 0.2 } = {}) {
  const out = [];
  for (const wall of walls) {
    const open = windowOpening(wall, height, foot), c = wall?.c;
    if (!open || !Array.isArray(c) || c.length < 4) continue;
    const [ax, ay, bx, by] = c.map(Number), len = Math.hypot(bx - ax, by - ay);
    if (!(len > 0)) continue;
    const ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux, mid = { x: (ax + bx) / 2, y: (ay + by) / 2 };
    const step = grid * 0.3, inA = indoors.some((p) => inside({ x: mid.x + nx * step, y: mid.y + ny * step }, p)), inB = indoors.some((p) => inside({ x: mid.x - nx * step, y: mid.y - ny * step }, p));
    if (inA === inB) continue;
    const into = inA ? 1 : -1, reach = grid * 2, spread = reach * 0.3, ox = nx * into * reach, oy = ny * into * reach;
    out.push({ points: [ax, ay, bx, by, bx + ox + ux * spread, by + oy + uy * spread, ax + ox - ux * spread, ay + oy - uy * spread], alpha: open.alpha });
  }
  return out;
}

// The glows' layer: build({ glows, bounds, alpha, covers }) bakes them, brightest at the opening and fading over the
// ground; its colour is the lights' (warm lamplight where they give none). `covers`: the tree and roof tiles over the
// ground (each { texture, x, y, width, height, rotation, anchorX, anchorY, alpha }), where the glow does not show, their
// leaves and eaves hiding the ground it lies on. Added to `root()` over the lit scene; clear() drops it.
// shadows(creatures) cuts the creatures' shadows out of it (glowShadows), sharp at their feet and softer further out,
// each in its creature's shape (its art's silhouette, flier-silhouette.mjs, laid out from its feet along the wedge);
// art with no outline of its own (a solid portrait) casts the wedge itself. Returns true while a silhouette is still
// being made (call again next frame).
// The longest a creature's shaped shadow is drawn, in its own lengths.
const SHAPE_STRETCH = 2.5;
export function createWindowGlow({ PIXI, root, render }) {
  let sprite = null, texture = null, shade = null, built = [], frame = null, shadowKey = '', made = null;
  // The creatures' silhouettes, made once per art and kept (made on first use: PIXI is not up when this loads).
  const silhouettes = () => (made ??= typeof PIXI?.Sprite === 'function' && typeof document !== 'undefined' ? createSilhouettes({ PIXI }) : null);
  const drop = () => {
    try { sprite?.parent?.removeChild(sprite); sprite?.destroy(); } catch { /* gone with the canvas */ }
    try { texture?.destroy(true); } catch { /* gone */ }
    try { shade?.destroy(true); } catch { /* gone */ }
    sprite = null; texture = null; shade = null; built = []; frame = null; shadowKey = '';
  };
  const SLICES = 6, WARM = 0xffc27a;
  return {
    build({ glows = [], bounds, alpha = 1, covers = [] } = {}) {
      drop();
      if (!glows.length || !bounds || !(alpha > 0.01)) return;
      const k = Math.min(RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      const at = (pts) => pts.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k);
      // Shutters' bands kept sharp (their own picture, barely softened), the rest soft.
      const stage = new PIXI.Container(), soft = new PIXI.Graphics(), bands = new PIXI.Graphics();
      soft.filters = [new PIXI.BlurFilter(SOFTNESS * 2)];
      bands.filters = [new PIXI.BlurFilter(SOFTNESS * 0.5)];
      for (const glow of glows) {
        const [ax, ay, bx, by, cx, cy, ex, ey] = glow.points, lerp = (p, q, t) => p + (q - p) * t, g = glow.slats > 0 ? bands : soft;
        // A lamp's light is warm whatever it is tinted; a coloured light only leans the glow its way.
        const tint = glow.color === null || glow.color === undefined ? WARM : [16, 8, 0].reduce((n, shift) => {
          const warm = (WARM >> shift) & 255, own = (glow.color >> shift) & 255;
          return n | (Math.round(warm * (0.55 + 0.45 * own / 255)) << shift);
        }, 0);
        // Through shutters: a band of light from each gap between the slats, with dark between.
        const n = glow.slats > 0 ? glow.slats : SLICES, lit = glow.slats > 0 ? 0.5 : 1;
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + lit) / n;
          g.beginFill(tint, glow.alpha * (1 - 0.8 * (i + 0.5) / n));
          g.drawPolygon(at([lerp(ax, ex, t0), lerp(ay, ey, t0), lerp(bx, cx, t0), lerp(by, cy, t0), lerp(bx, cx, t1), lerp(by, cy, t1), lerp(ax, ex, t1), lerp(ay, ey, t1)]));
          g.endFill();
        }
      }
      stage.addChild(soft, bands);
      // Under the trees' leaves and the roofs' eaves the glow is hidden: each tile's picture cut out of it.
      for (const t of covers) {
        if (!t?.texture) continue;
        const leaves = new PIXI.Sprite(t.texture);
        leaves.anchor.set(t.anchorX ?? 0.5, t.anchorY ?? 0.5);
        leaves.position.set((t.x - bounds.x) * k, (t.y - bounds.y) * k);
        leaves.width = Math.abs(t.width) * k; leaves.height = Math.abs(t.height) * k;
        leaves.rotation = t.rotation ?? 0;
        leaves.alpha = t.alpha ?? 1;
        leaves.blendMode = PIXI.BLEND_MODES.ERASE;
        stage.addChild(leaves);
      }
      texture = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      built = glows; frame = { bounds, k, w, h };
      if (typeof PIXI.Mesh === 'function') {
        // Drawn through the creatures' shadows (none until shadows() is given them).
        shade = PIXI.RenderTexture.create({ width: w, height: h });
        // The scene's share of the pictures (rounded up to whole pixels).
        const b = bounds, u = (b.width * k) / w, v = (b.height * k) / h, geometry = new PIXI.Geometry()
          .addAttribute('aVertexPosition', [b.x, b.y, b.x + b.width, b.y, b.x + b.width, b.y + b.height, b.x, b.y + b.height], 2)
          .addAttribute('aUvs', [0, 0, u, 0, u, v, 0, v], 2).addIndex([0, 1, 2, 0, 2, 3]);
        sprite = new PIXI.Mesh(geometry, PIXI.Shader.from(MOTES_VERT, GLOW_FRAG, { uGlow: texture, uShade: shade, uAlpha: alpha }));
      } else {
        sprite = new PIXI.Sprite(texture);
        sprite.position.set(bounds.x, bounds.y);
        sprite.scale.set(1 / k, 1 / k);
        sprite.alpha = alpha;
      }
      sprite.eventMode = 'none';
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      root().addChild(sprite);
    },
    // The creatures standing about ([{ x, y, r, height }], glowShadows): their shadows cut out of the glows, redrawn
    // only when one in a glow has moved.
    shadows(creatures = []) {
      if (!shade || !frame) return;
      const cast = glowShadows(built, creatures), store = silhouettes();
      const shapes = cast.map((s) => (s.art?.texture && store ? store.get(s.art.texture, SILHOUETTE_SIZE) : null));
      const waiting = cast.some((s) => s.art?.texture && store && !store.known(s.art.texture, SILHOUETTE_SIZE));
      const key = cast.map((s, i) => `${s.points.map((v) => Math.round(v)).join(',')}${shapes[i] ? '*' : ''}`).join(';');
      if (key === shadowKey) return waiting;
      shadowKey = key;
      const { bounds, k } = frame, at = (p) => p.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k);
      const stage = new PIXI.Container(), lerp = (p, q, t) => p + (q - p) * t, SLICES = 5;
      // Each creature's shadows drawn on their own, its own body cut out of them (it stands in the light it blocks,
      // its token lit), then added to the rest: another creature's shadow still falls across it.
      const Alpha = PIXI.AlphaFilter ?? PIXI.filters?.AlphaFilter, groups = new Map();
      const groupOf = (body) => {
        const key = `${Math.round(body.x)},${Math.round(body.y)}`;
        if (!groups.has(key)) {
          const box = new PIXI.Container(), g = new PIXI.Graphics(), lit = new PIXI.Graphics();
          // Each window point's share added: whole where all of them are hidden.
          g.blendMode = PIXI.BLEND_MODES.ADD;
          lit.blendMode = PIXI.BLEND_MODES.ERASE;
          lit.beginFill(0xffffff, 1); lit.drawCircle((body.x - bounds.x) * k, (body.y - bounds.y) * k, body.r * k); lit.endFill();
          box.addChild(g);
          if (Alpha) { const own = new Alpha(1); own.blendMode = PIXI.BLEND_MODES.ADD; box.filters = [own]; }
          groups.set(key, { box, g, lit });
        }
        return groups.get(key);
      };
      cast.forEach((s, n) => {
        const [ax, ay, bx, by, cx, cy, ex, ey] = s.points, shape = shapes[n], { box, g } = groupOf(s.body);
        if (shape && typeof PIXI.Sprite === 'function') {
          // Its art turned to the light, its head away from it and its feet by the creature, laid out along the light,
          // stretched along it and flattened across it. Stretched no more than SHAPE_STRETCH times, so it still reads as
          // the creature.
          const tipx = (cx + ex) / 2, tipy = (cy + ey) / 2, along = Math.atan2(tipy - s.body.y, tipx - s.body.x);
          const size = (2 * s.body.r) / 0.95, stretch = Math.min(SHAPE_STRETCH, Math.max(1, Math.hypot(tipx - s.body.x, tipy - s.body.y) / size));
          const art = s.art, fit = silhouetteScale({ artWidth: (art.width || size) * (shape.fill?.w ?? 1), artHeight: (art.height || size) * (shape.fill?.h ?? 1), width: size });
          const outer = new PIXI.Container(), figure = new PIXI.Sprite(shape.sharp.texture), out = (size * stretch) / 2;
          outer.position.set((s.body.x + Math.cos(along) * out - bounds.x) * k, (s.body.y + Math.sin(along) * out - bounds.y) * k);
          outer.rotation = along;
          outer.scale.set(stretch * k, 0.85 * k);
          figure.anchor.set(0.5);
          // Its top along the light (the container turned to it).
          figure.rotation = Math.PI / 2;
          figure.scale.set((((art.width || size) * fit) / shape.width) * (art.flipX ? -1 : 1), (((art.height || size) * fit) / shape.height) * (art.flipY ? -1 : 1));
          figure.blendMode = PIXI.BLEND_MODES.ADD;
          figure.alpha = 0.95 * s.depth;
          outer.addChild(figure);
          box.addChild(outer);
          return;
        }
        // Darkest at the creature; the window's breadth softens its own shadow further out, the lamp's stays hard.
        const fade = s.hard ? 0.15 : 0.4;
        for (let i = 0; i < SLICES; i++) {
          const t0 = i / SLICES, t1 = (i + 1) / SLICES;
          g.beginFill(0x000000, (0.95 - fade * (i + 0.5) / SLICES) * s.depth);
          g.drawPolygon(at([lerp(ax, ex, t0), lerp(ay, ey, t0), lerp(bx, cx, t0), lerp(by, cy, t0), lerp(bx, cx, t1), lerp(by, cy, t1), lerp(ax, ex, t1), lerp(ay, ey, t1)]));
          g.endFill();
        }
      });
      for (const { box, lit } of groups.values()) { box.addChild(lit); stage.addChild(box); }
      stage.filters = [new PIXI.BlurFilter(SOFTNESS)];
      try { render(stage, shade); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      return waiting;
    },
    clear: drop,
    get built() { return !!sprite; },
  };
}

// Dust drifting in the light: specks that turn slowly in the air and catch the sun, only where a shaft falls.
const MOTES_VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec2 aUvs;
uniform mat3 translationMatrix, projectionMatrix;
varying vec2 vUv;
void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
const MOTES_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uShafts;
uniform vec2 uSize;
uniform vec3 uColor;
uniform float uTime, uGrid, uAlpha;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  float lit = texture2D(uShafts, vUv).a;
  if (lit < 0.02) { gl_FragColor = vec4(0.0); return; }
  vec2 px = vUv * uSize;
  float cell = uGrid * 0.22, best = 0.0;
  // Two layers of specks at different sizes and speeds, each wandering on its own slow loop.
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer), speed = 0.06 + 0.05 * fl;
    vec2 drift = vec2(sin(uTime * speed * 1.7 + fl), cos(uTime * speed * 1.3 + fl * 2.0)) * cell * 0.8 + vec2(0.0, -uTime * cell * 0.04);
    vec2 q = (px + drift) / (cell * (1.0 + 0.6 * fl));
    vec2 c = floor(q), f = fract(q);
    float h = hash(c + fl * 13.0);
    vec2 at = vec2(hash(c + 1.7), hash(c + 4.3)) * 0.8 + 0.1 + 0.08 * vec2(sin(uTime * (0.4 + h) + h * 9.0), cos(uTime * (0.3 + h) + h * 5.0));
    float glint = 0.55 + 0.45 * sin(uTime * (1.0 + 2.0 * h) + h * 30.0);
    float r = 0.035 + 0.03 * h;
    best = max(best, step(0.55, h) * glint * (1.0 - smoothstep(r * 0.4, r, length(f - at))));
  }
  float a = best * lit * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

// The shafts' layer: build({ shafts, bounds, indoors (the roofs, as for the shadows), color (0xrrggbb), alpha }) bakes
// them, brightest at the opening and spreading fainter across the floor, kept only under the roofs, with dust drifting
// in them; tick(seconds) moves the dust; clear() drops them. Added to `root()` over the lit scene.
export function createWindowShafts({ PIXI, root, render }) {
  let sprite = null, texture = null, motes = null;
  const drop = () => {
    try { sprite?.parent?.removeChild(sprite); sprite?.destroy(); } catch { /* gone with the canvas */ }
    try { motes?.parent?.removeChild(motes); motes?.destroy(); } catch { /* gone with the canvas */ }
    try { texture?.destroy(true); } catch { /* gone */ }
    sprite = null; texture = null; motes = null;
  };
  const SLICES = 6;
  return {
    build({ shafts = [], bounds, indoors = [], color = 0xfff2d8, alpha = 1, grid = 100 } = {}) {
      drop();
      if (!shafts.length || !indoors.length || !bounds || !(alpha > 0)) return;
      const k = Math.min(RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      const at = (p) => p.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k);
      const stage = new PIXI.Container(), g = new PIXI.Graphics();
      // Each patch in slices from the opening out, fading as the light spreads.
      for (const s of shafts) {
        const [ax, ay, bx, by, cx, cy, ex, ey] = s.points, lerp = (p, q, t) => p + (q - p) * t;
        for (let i = 0; i < SLICES; i++) {
          const t0 = i / SLICES, t1 = (i + 1) / SLICES;
          g.beginFill(0xffffff, s.alpha * (1 - 0.65 * (i + 0.5) / SLICES));
          g.drawPolygon(at([lerp(ax, ex, t0), lerp(ay, ey, t0), lerp(bx, cx, t0), lerp(by, cy, t0), lerp(bx, cx, t1), lerp(by, cy, t1), lerp(ax, ex, t1), lerp(ay, ey, t1)]));
          g.endFill();
        }
      }
      // Only under the roofs.
      const roofs = new PIXI.Graphics();
      for (const p of indoors) { roofs.beginFill(0xffffff, 1); roofs.drawPolygon(at(p)); for (const hole of p.holes ?? []) { roofs.beginHole(); roofs.drawPolygon(at(hole)); roofs.endHole(); } roofs.endFill(); }
      g.mask = roofs;
      stage.addChild(g, roofs);
      stage.filters = [new PIXI.BlurFilter(SOFTNESS * 1.5)];
      texture = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      sprite = new PIXI.Sprite(texture);
      sprite.eventMode = 'none';
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      sprite.tint = color;
      sprite.position.set(bounds.x, bounds.y);
      sprite.scale.set(1 / k, 1 / k);
      sprite.alpha = alpha;
      root().addChild(sprite);
      if (typeof PIXI.Mesh === 'function') {
        const b = bounds, geometry = new PIXI.Geometry()
          .addAttribute('aVertexPosition', [b.x, b.y, b.x + b.width, b.y, b.x + b.width, b.y + b.height, b.x, b.y + b.height], 2)
          .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
        const c = new PIXI.Color(color);
        motes = new PIXI.Mesh(geometry, PIXI.Shader.from(MOTES_VERT, MOTES_FRAG, { uShafts: texture, uSize: [b.width, b.height], uColor: [c.red, c.green, c.blue], uTime: 0, uGrid: grid, uAlpha: Math.min(1, alpha * 1.4) }));
        motes.eventMode = 'none';
        motes.blendMode = PIXI.BLEND_MODES.ADD;
        root().addChild(motes);
      }
    },
    tick(seconds) { if (motes && !motes.destroyed) motes.shader.uniforms.uTime += seconds; },
    clear: drop,
    get built() { return !!sprite; },
  };
}

// Whether `point` lies in a wall's shadow, and how deep (the strongest covering it, 0 none): a creature `elevation`
// squares up (flying, or standing on something) is above a wall no taller than that.
export function inWallShade(point, quads = [], { elevation = 0 } = {}) {
  let deepest = 0;
  for (const q of quads) {
    if (!(q.alpha > deepest) || (Number(elevation) || 0) >= q.top) continue;
    if (inside(point, q.points)) deepest = q.alpha;
  }
  return deepest;
}

// How much of a creature `width` pixels across, standing at `point`, lies in walls' shadows (0–1): its footprint
// sampled three by three, so a dragon with a third of it out in the sun keeps a third of its sun shadow.
export function shadeAcross(point, width, quads = [], { elevation = 0 } = {}) {
  if (!quads.length) return 0;
  const step = (Number(width) || 0) / 3;
  let total = 0;
  for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) total += inWallShade({ x: point.x + i * step, y: point.y + j * step }, quads, { elevation });
  return total / 9;
}

// Even-odd point in a polygon (flat x, y pairs); not in one of its `holes`.
function inside({ x, y }, p) {
  if (p?.holes?.some((hole) => inside({ x, y }, hole))) return false;
  let hit = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// The layer: build({ quads, bounds (the scene's { x, y, width, height }), alpha (how dark, the sun's strength in it),
// indoors (polygons, flat x, y pairs: under a roof the sun never reaches) }) bakes them; clear() drops them. `render(g,
// rt)` draws a display object into a render texture (Foundry's renderer; in tests, a record).
export function createWallShadows({ PIXI, root, render }) {
  let sprite = null, texture = null, sunlitTexture = null, sunlit = null;
  const drop = () => {
    try { sprite?.parent?.removeChild(sprite); sprite?.destroy(); } catch { /* gone with the canvas */ }
    try { texture?.destroy(true); } catch { /* gone */ }
    try { sunlitTexture?.destroy(true); } catch { /* gone */ }
    sprite = null; texture = null; sunlitTexture = null; sunlit = null;
  };
  return {
    build({ quads = [], bounds, alpha = 1, indoors = [] } = {}) {
      drop();
      if (!quads.length || !bounds || !(alpha > 0)) return;
      // Never past what any graphics card takes (a huge scene's picture is drawn a little smaller still).
      const k = Math.min(RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      const at = (p) => p.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k);
      const g = new PIXI.Graphics();
      // A whole wall's shadow drawn solid (overlapping ones never darker), a half one at half.
      for (const q of quads) { g.beginFill(0x000000, q.alpha); g.drawPolygon(at(q.points)); g.endFill(); }
      // Under a roof (a region that keeps the weather out) the sun never reaches: nothing drawn there.
      if (indoors.length) {
        const roof = new PIXI.Graphics();
        roof.blendMode = PIXI.BLEND_MODES.ERASE;
        for (const p of indoors) { roof.beginFill(0xffffff, 1); roof.drawPolygon(at(p)); for (const hole of p.holes ?? []) { roof.beginHole(); roof.drawPolygon(at(hole)); roof.endHole(); } roof.endFill(); }
        g.addChild(roof);
      }
      g.filters = [new PIXI.BlurFilter(SOFTNESS)];
      texture = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(g, texture); } finally { try { g.destroy({ children: true }); } catch { /* drawn */ } }
      sprite = new PIXI.Sprite(texture);
      sprite.eventMode = 'none';
      sprite.position.set(bounds.x, bounds.y);
      sprite.scale.set(1 / k, 1 / k);
      sprite.alpha = alpha;
      root().addChild(sprite);
      // The sunlit floor beside it: white where the sun reaches, cut out where a wall shades it (half behind a half
      // wall) or a roof covers it, as soft. Creatures' sun shadows are masked by it, so a floor already in a wall's
      // shade never darkens twice. Never drawn itself.
      const lit = new PIXI.Graphics();
      lit.beginFill(0xffffff, 1); lit.drawPolygon([0, 0, w, 0, w, h, 0, h]); lit.endFill();
      const shade = new PIXI.Graphics();
      shade.blendMode = PIXI.BLEND_MODES.ERASE;
      for (const q of quads) { shade.beginFill(0xffffff, q.alpha); shade.drawPolygon(at(q.points)); shade.endFill(); }
      for (const p of indoors) { shade.beginFill(0xffffff, 1); shade.drawPolygon(at(p)); for (const hole of p.holes ?? []) { shade.beginHole(); shade.drawPolygon(at(hole)); shade.endHole(); } shade.endFill(); }
      lit.addChild(shade);
      lit.filters = [new PIXI.BlurFilter(SOFTNESS)];
      sunlitTexture = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(lit, sunlitTexture); } finally { try { lit.destroy({ children: true }); } catch { /* drawn */ } }
      sunlit = { texture: sunlitTexture, x: bounds.x, y: bounds.y, scale: 1 / k };
    },
    clear: drop,
    get built() { return !!sprite; },
    // { texture, x, y, scale } (laid as a sprite at x, y, scaled), or null with no wall shading the floor.
    get sunlit() { return sunlit; },
  };
}
