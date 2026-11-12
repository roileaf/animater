// Walls in the sun (the "Walls cast shadows in sunlight" setting): each wall that stops light throws its shadow on the
// floor away from the sun (sun.mjs), as long as its height and the sun's make it. Foundry's own lights already stop at
// walls; the sun had nothing. The shadows are baked once into one soft picture under the creatures and kept until the
// sun, the walls or the scene change, so a scene in daylight costs one sprite a frame.

import { createSilhouettes, laidArt, silhouetteScale, SILHOUETTE_SIZE } from './flier-silhouette.mjs';

// The longest a wall's shadow grows (squares), with the sun on the horizon: past it, it is cut.
export const WALL_SHADOW_CAP = 12;
// The picture is drawn at this share of the scene's size: soft by nature, and cheap.
const RESOLUTION = 0.25, SHAFT_RESOLUTION = 0.5;
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
// squares) }. A wall with `noShadow` (Wall configuration → Animater shadow) throws none. `walls`: [{ c: [x1, y1, x2, y2], light, door, ds, top?, bottom? (its own, in squares up from the floor:
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
    if (wall?.noShadow || !(alpha > 0) || !Array.isArray(c) || c.length < 4) continue;
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
export const WINDOW_KINDS = { glass: 0.8, open: 1, curtained: 0.4, shuttered: 0.55, mosaic: 0.85, leaded: 0.75, rose: 0.85, frosted: 0.5, lattice: 0.65, bars: 0.85, slit: 1 };
// The windows that open and close (window-state.mjs CLOSING_WINDOWS), by what fills them when shut; a wooden one, nothing.
const SHUT_LOOK = Object.freeze({ glassWindow: 'glass', curtainWindow: 'curtained', shutterWindow: 'shuttered', mosaicWindow: 'mosaic', leadedWindow: 'leaded', roseWindow: 'rose', frostedWindow: 'frosted' });
// What each prints in its light (createWindowShafts): a frame's cross or bar, coloured panes, a net, a grid, stripes.
const PRINTS = Object.freeze({ glass: 'cross', shuttered: 'bar', mosaic: 'mosaic', leaded: 'leaded', rose: 'rose', lattice: 'lattice', bars: 'bars', frosted: 'frosted' });
export const printOf = (kind) => PRINTS[kind] ?? null;
// What can fill an opening in a roof (region configuration, `skyWindow`): [key, name]; '' none. Glazed ones keep the weather out
// and let the sun and the clouds' shadows through.
export const SKY_WINDOWS = Object.freeze([['', 'None: open to the weather'], ['glass', 'Glass skylight'], ['mosaic', 'Mosaic or stained glass'], ['leaded', 'Leaded diamonds'], ['rose', 'Rose window'], ['frosted', 'Frosted glass'], ['lattice', 'Wooden lattice'], ['bars', 'Iron grate']]);
export const GLAZED = Object.freeze(new Set(['glass', 'mosaic', 'leaded', 'rose', 'frosted']));
export const skyWindowOf = (own) => (SKY_WINDOWS.some(([k]) => k && k === own?.skyWindow) ? own.skyWindow : '');
export function windowOpening(wall = {}, height = 2, foot = 0.2) {
  const given = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const bottom = given(wall.bottom) ? Math.max(0, Number(wall.bottom)) : 0;
  const top = given(wall.top) && Number(wall.top) > bottom ? Number(wall.top) : bottom + height, ft = Number(foot) > 0 ? Number(foot) : 0.2;
  const upTo = (feet) => Math.min(top, bottom + feet * ft);
  if (Number(wall.door) > 0) return Number(wall.ds) === 1 ? { bottom, top: upTo(7), alpha: 1, kind: 'open' } : null;
  // One that opens and closes (window-state.mjs): a shut wooden window lets nothing through, shut shutters or glass their share; open, an empty frame.
  if (wall.kind === 'woodWindow' || Object.hasOwn(SHUT_LOOK, wall.kind ?? '')) {
    if (!wall.open && (wall.kind === 'woodWindow' || (wall.kind === 'shutterWindow' && !wall.slats))) return null;
    const shut = SHUT_LOOK[wall.kind] ?? 'glass';
    return upTo(7) > upTo(3) ? { bottom: upTo(3), top: upTo(7), alpha: wall.open ? 1 : WINDOW_KINDS[shut], kind: wall.open ? 'open' : shut } : null;
  }
  // A window: Foundry's Window (light proximity or distance), or glass drawn as a wall that lets the light through
  // freely (none) but stops movement; or any wall given a kind.
  const light = Number(wall.light) || 0, glass = light === 0 && Number(wall.move) > 0, kind = WINDOW_KINDS[wall.kind] ? wall.kind : null;
  // A wall smashed open (wall-break.mjs): a hole its whole height, the light going through it whole.
  if (!kind && wall.broken === true) return { bottom, top, alpha: 1, kind: 'open' };
  return (kind || light >= 30 || glass) && upTo(7) > upTo(3) ? { bottom: upTo(3), top: upTo(7), alpha: WINDOW_KINDS[kind ?? 'glass'], kind: kind ?? 'glass' } : null;
}
// Each opening's patch of light: { points (a quadrilateral, flat x, y pairs; its first two points along the near
// edge), alpha }. As wallShadowQuads, for the same walls, sun and height. `indoors` the roofs: an opening whose sunward
// side is under one too (a door between two rooms) lets no daylight through. `shade` the walls' shadows
// (wallShadowQuads's): an opening another wall taller than it shades from the sun lets that much less through.
// How far along a ray (from `p`, the unit way `d`) the first wall stops the light, up to `most` (pure): any wall that blocks
// light, not the window itself (`skip`) nor another opening.
export function wallAlong(p, d, walls, options = {}) { return wallHitAlong(p, d, walls, options).t; }
// The same, with the wall it meets (null: none before `most`).
export function wallHitAlong(p, d, walls, { skip = null, most = Infinity, height = 2, foot = 0.2 } = {}) {
  let best = most, hit = null;
  for (const wall of walls) {
    const c = wall?.c; if (!Array.isArray(c) || c.length < 4 || wall === skip) continue;
    if (!(Number(wall.light) > 0) || windowOpening(wall, height, foot)) continue;
    const [x1, y1, x2, y2] = c.map(Number), ex = x2 - x1, ey = y2 - y1, den = d.x * ey - d.y * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((x1 - p.x) * ey - (y1 - p.y) * ex) / den, u = ((x1 - p.x) * d.y - (y1 - p.y) * d.x) / den;
    if (t > 1 && t < best && u >= 0 && u <= 1) { best = t; hit = wall; }
  }
  return { t: best, wall: hit };
}
// Whether two walls lie along one line (pure): a long wall drawn in pieces is still one wall.
export const sameWallLine = (a, b, tolerance = 2) => {
  if (!a || !b) return false; if (a === b) return true;
  const [x1, y1, x2, y2] = a.c.map(Number), len = Math.hypot(x2 - x1, y2 - y1) || 1, off = (x, y) => Math.abs((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) / len;
  return off(Number(b.c[0]), Number(b.c[1])) <= tolerance && off(Number(b.c[2]), Number(b.c[3])) <= tolerance;
};
export function windowShafts({ walls = [], sun = null, grid = 100, height = 2, indoors = [], foot = 0.2, shade = [], blocked = () => false } = {}) {
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
    let [ax, ay, bx, by] = c.map(Number);
    // An arrow slit: only a narrow slot of it lets the light through.
    if (open.kind === 'slit') { const mx = (ax + bx) / 2, my = (ay + by) / 2, len = Math.hypot(bx - ax, by - ay) || 1, half = Math.max(grid * 0.05, len * 0.06), ux = (bx - ax) / len, uy = (by - ay) / len; ax = mx - ux * half; ay = my - uy * half; bx = mx + ux * half; by = my + uy * half; }
    const sunward = { x: (ax + bx) / 2 - dx * grid * 0.5, y: (ay + by) / 2 - dy * grid * 0.5 };
    if (indoors.some((p) => inside(sunward, p))) continue;
    // Another wall hard up against it, on the sun's side, stops light: none gets in.
    if (blocked({ x: (ax + bx) / 2 - dx * 2, y: (ay + by) / 2 - dy * 2 }, sunward)) continue;
    // The sun on the opening: just outside it, halfway up it.
    const sill = { x: (ax + bx) / 2 - dx * grid * 0.15, y: (ay + by) / 2 - dy * grid * 0.15 };
    const alpha = open.alpha * (1 - shadedAbove(sill, shade, { elevation: (open.bottom + open.top) / 2, sun, grid, skip: [ax, ay, bx, by] }));
    if (!(alpha > 0.05)) continue;
    // Stopped by the far wall: each edge of the light runs only as far as the first wall in its way, and what would have
    // gone on climbs that wall (`wall`: where it meets it, and how much of the light that is).
    const way = { x: dx, y: dy }, ha = wallHitAlong({ x: ax, y: ay }, way, walls, { skip: wall, most: far, height, foot }), hb = wallHitAlong({ x: bx, y: by }, way, walls, { skip: wall, most: far, height, foot });
    // Edges stopped by two different walls (one through a doorway): the whole patch stops at the nearer, never spilling
    // across a wall into the next room.
    const split = (ha.wall || hb.wall) && !sameWallLine(ha.wall, hb.wall), fa = split ? Math.min(ha.t, hb.t) : ha.t, fb = split ? Math.min(ha.t, hb.t) : hb.t;
    // The band at the foot of the far wall only where both edges of the light meet that one wall: split between two (one
    // edge through a doorway), a line between them would cut across the room.
    const hit = fa < far - 1 && fb < far - 1 && sameWallLine(ha.wall, hb.wall) ? { points: [ax + dx * fa, ay + dy * fa, bx + dx * fb, by + dy * fb], share: Math.min(1, (far - Math.min(fa, fb)) / far) } : null;
    // A window's frame printed in its light: a cross for shut glass, the bar where a pair of shutters meet (their slats
    // already make the bands). Thrown open, whatever it is, its leaves are out of the way and the light comes in whole, as
    // through a doorway; a curtain's cloth has none.
    const framed = Number(wall.door) > 0 ? false : PRINTS[open.kind] ?? false;
    out.push({ points: [ax + dx * near, ay + dy * near, bx + dx * near, by + dy * near, bx + dx * fb, by + dy * fb, ax + dx * fa, ay + dy * fa], alpha, slats: open.kind === 'shuttered' ? Math.max(3, Math.round((far - near) / (grid * 0.3))) : 0, panes: framed, leaves: typeof wall.kind === 'string' && /Window$/.test(wall.kind), scale: patternScaleOf(wall.pattern), soft: open.kind === 'frosted', wall: hit, from: [ax, ay, bx, by] });
  }
  return out;
}

// Warm light from windows at night: an opening between a lit room and the open air spills that room's light onto the
// ground outside, fanning out from it. Each { points (a quadrilateral, flat x, y pairs; its first two points along the
// opening), alpha, color (0xrrggbb, its brightest light's, null for warm lamplight), from (the opening's middle), up (its
// middle's height, squares), past (just outside it), reach (px), lamp ({ x, y }: the light inside lighting it most), room (its polygon), kind (windowOpening's), slats (bands of light through shutters, 0 none),
// shadow (how dark a creature's shadow in it is: a curtain's spread light throws only a faint one), panes (what its window
// prints in the light going out, as windowShafts': a frame's cross, coloured panes, a net; false none), leaves, scale }. A curtain's glow
// is dim, short and wide. `indoors` the rooms (the regions
// that keep the weather out); `lights` the lights burning ({ x, y, radius px, color }): one inside the room, reaching the
// opening, lights it, the nearer the brighter. A door between two rooms, or a window with the open air on both sides,
// spills nothing.
// `blocked(from, to)`: whether walls stop light between two points. A window only shows a light that gets to it.
// How bright a lamp's light lies on the ground at `r` (px, across the ground) from a lamp held `up` (px) over it (pure,
// relative): the inverse square of the distance, times the slant it lands at, so it fades about as the cube of the distance
// once past the lamp's height (a candle's 1 lux at a metre is 0.04 at five; ground six metres off a lamp held at one and a
// half gets a fortieth of the ground at one).
export const groundLight = (r, up) => up / Math.pow(up * up + r * r, 1.5);
// Where a lamp's light out of an opening fades into the night (pure, 0–1 of its brightness at the opening): sooner under a
// bright moon (`ambient` 0 a dark night – 1 moonlit or dusk), the ground round it no longer dark enough to show it.
export const glowCutoff = (ambient = 0) => 0.12 + 0.25 * Math.min(1, Math.max(0, Number(ambient) || 0));
// How bright a glow is at `t` along it (0 the opening – 1 its far end; pure, 0–1): its lamp's light on the ground there
// against at the opening, down to nothing where it fades into the night (glowCutoff). A glow with no lamp fades evenly.
export function glowFade(glow, t) {
  const f = glow?.fall, v = Math.min(1, Math.max(0, Number(t) || 0));
  if (!f) return 1 - 0.8 * v;
  const at = Math.hypot(f.ahead + v * f.reach, f.side), ratio = groundLight(at, f.up) / groundLight(Math.hypot(f.ahead, f.side), f.up);
  return Math.max(0, Math.min(1, (ratio - f.cutoff) / (1 - f.cutoff)));
}
// `ambient`: how light the night is round the house (glowCutoff).
export function windowGlows({ walls = [], indoors = [], lights = [], grid = 100, height = 2, foot = 0.2, blocked = () => false, ambient = 0 } = {}) {
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
    const room = roomA ?? roomB, away = roomA ? -1 : 1, within = roomA ? sideA : sideB;
    // How brightly the room is lit at the opening: its brightest light that reaches it.
    let best = 0, color = null, lamp = null;
    for (const l of lights) {
      const r = Number(l?.radius) || 0;
      if (!(r > 0) || !inside(l, room)) continue;
      const lit = 1 - Math.hypot(l.x - mid.x, l.y - mid.y) / r;
      if (lit > best && !blocked({ x: l.x, y: l.y }, within)) { best = lit; color = Number.isFinite(l.color) ? l.color : null; lamp = { x: l.x, y: l.y }; }
    }
    if (!(best > 0.05)) continue;
    const strength = Math.min(1, best * 1.6), curtained = open.kind === 'curtained';
    // How far it shows: out from the opening until the lamp's light on the ground (held at about five feet) fades into the
    // night, never past four squares. Cloth spreads it shorter. A lamp right by the window lights the ground just outside
    // brightly and little beyond; one across the room, less brightly but further.
    const up = 5 * foot * grid, cutoff = glowCutoff(ambient), ahead = lamp ? Math.max(grid * 0.15, (mid.x - lamp.x) * nx * away + (mid.y - lamp.y) * ny * away) : grid, side = lamp ? Math.abs((mid.x - lamp.x) * ux + (mid.y - lamp.y) * uy) : 0;
    const at0 = groundLight(Math.hypot(ahead, side), up);
    let out0 = grid * 0.4; while (out0 < grid * 4 && groundLight(Math.hypot(ahead + out0, side), up) / at0 > cutoff) out0 += grid * 0.1;
    const reach = out0 * (curtained ? 0.6 : 1), spread = reach * (curtained ? 0.7 : 0.35);
    const ox = nx * away * reach, oy = ny * away * reach;
    // Through clear openings the lamp's light goes on in straight lines: the patch fans from the lamp through the opening's
    // two ends (off to one side when the lamp is, wider the nearer the lamp stands to it), so whoever stands in it sees the
    // lamp through the window. Cloth and frosted glass spread it evenly instead.
    let far = [bx + ox + ux * spread, by + oy + uy * spread, ax + ox - ux * spread, ay + oy - uy * spread];
    if (lamp && !curtained && open.kind !== 'frosted') {
      // (Its wide far end, with a lamp close by, is past where the light still shows: it fades out before it, glowFade.)
      const end = (px, py) => { const dx = px - lamp.x, dy = py - lamp.y, along = Math.max(grid * 0.15, dx * nx * away + dy * ny * away), k = reach / along; return [px + dx * k, py + dy * k]; };
      far = [...end(bx, by), ...end(ax, ay)];
    }
    out.push({ points: [ax, ay, bx, by, ...far], alpha: open.alpha * strength, color, fall: { ahead, side, up, reach, cutoff },
      from: mid, past: { x: mid.x + nx * away * 2, y: mid.y + ny * away * 2 }, up: (open.bottom + open.top) / 2, reach, kind: open.kind, lamp, room,
      slats: open.kind === 'shuttered' ? Math.max(3, Math.round(reach / (grid * 0.3))) : 0, shadow: curtained ? 0.3 : open.kind === 'shuttered' ? 0.8 : 1,
      // The lamp's light leaves through the window as the sun's comes in: carrying its panes out onto the ground (frosted
      // glass only spreads it, a door or a window thrown open lets it out whole).
      panes: Number(wall.door) > 0 || open.kind === 'frosted' ? false : PRINTS[open.kind] ?? false, leaves: typeof wall.kind === 'string' && /Window$/.test(wall.kind), scale: patternScaleOf(wall.pattern) });
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
// share of the glow's `shadow`), hard (the lamp's: barely fading), art }], added together where they overlap. `walls`
// (as wallShadowQuads's): a creature with a wall that stops light between it and the lamp (a closed door, a room's wall
// under the same roof) casts no shadow from it.
export const WINDOW_SAMPLES = 4;
// A wall that stops a lamp's light: one that blocks light and is no opening (a window, an open door).
const solid = (w) => Number(w.light) > 0 && !windowOpening(w);
// Where along the line from a to b (0–1) the first solid wall crosses it, or Infinity.
const firstWall = (a, b, walls) => {
  let best = Infinity;
  for (const w of walls) {
    if (!solid(w)) continue;
    const [x1, y1, x2, y2] = w.c, d = (b.x - a.x) * (y2 - y1) - (b.y - a.y) * (x2 - x1);
    if (Math.abs(d) < 1e-9) continue;
    const t = ((x1 - a.x) * (y2 - y1) - (y1 - a.y) * (x2 - x1)) / d, u = ((x1 - a.x) * (b.y - a.y) - (y1 - a.y) * (b.x - a.x)) / d;
    if (t > 0.001 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
};
const lightBlocked = (a, b, walls) => firstWall(a, b, walls) < 0.999;
export const LAMP_SHARE = 0.7;
const GLOW_BOB = 2;
export function glowShadows(glows = [], creatures = [], { walls = [] } = {}) {
  const out = [];
  // A wedge from the light at `L` past the creature, `far` from the light at most.
  const wedge = (who, L, far, lh, depth, hard = false) => {
    const off = Math.hypot(who.x - L.x, who.y - L.y) || 1, lift = (Number(who.bob) || 0) * GLOW_BOB;
    // Hovering (`bob`, px up): its shadow moves along the light with it, away as it rises, back as it dips.
    const c = lift ? { ...who, x: who.x + ((who.x - L.x) / off) * lift, y: who.y + ((who.y - L.y) / off) * lift } : who;
    const r = Number(c.r) || 0, hc = Number(c.height) || 1, d = Math.hypot(c.x - L.x, c.y - L.y);
    if (d <= r * 1.05) return;
    let reach = hc >= lh ? far : Math.min(far, (d * lh) / (lh - hc));
    // A lamp's shadow stops at the first wall past the creature (it goes on only through a window or an open door); walls
    // between the lamp and the creature were weighed already, and one it stands beside at the light's edge is no stop.
    if (hard && walls.length && reach > d) { const far = { x: L.x + ((c.x - L.x) / d) * reach, y: L.y + ((c.y - L.y) / d) * reach }, hit = firstWall(c, far, walls); if (Number.isFinite(hit)) reach = d + (reach - d) * hit; }
    if (reach <= d) return;
    // Where the light's rays graze the creature's sides.
    const back = Math.atan2(L.y - c.y, L.x - c.x), turn = Math.acos(r / d), side = [];
    for (const sgn of [1, -1]) {
      const tx = c.x + r * Math.cos(back + sgn * turn), ty = c.y + r * Math.sin(back + sgn * turn), td = Math.hypot(tx - L.x, ty - L.y);
      side.push([tx, ty, L.x + ((tx - L.x) / td) * reach, L.y + ((ty - L.y) / td) * reach]);
    }
    out.push({ points: [side[0][0], side[0][1], side[1][0], side[1][1], side[1][2], side[1][3], side[0][2], side[0][3]], body: { x: c.x, y: c.y, r: (Number(c.half) || r / 0.64) * 0.95 }, depth, hard, art: c.art ?? null, id: who.id ?? null });
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
      // Any of it counts: its middle, or either side of it across the light (one at the light's very edge, the window's end
      // in line between it and the lamp, is still lit along its side).
      const d = Math.hypot(c.x - lamp.at.x, c.y - lamp.at.y) || 1, sx = (-(c.y - lamp.at.y) / d) * (Number(c.r) || 0) * 0.9, sy = ((c.x - lamp.at.x) / d) * (Number(c.r) || 0) * 0.9;
      const parts = [c, { x: c.x + sx, y: c.y + sy }, { x: c.x - sx, y: c.y - sy }];
      if (lamp.rooms.length && !lamp.rooms.some((room) => inside(c, room)) && !lamp.glows.some((g) => parts.some((p) => inside(p, g)))) continue;
      if (walls.length && parts.every((p) => lightBlocked(lamp.at, p, walls))) continue;
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
// Of the windows' patches, the ones a strike at `place` lights (pure): a window looks out one way, and a flash behind the house reaches none of it. Each keeps its own, dimmer the more it looks away. No place known: all.
export function windowsFacing(windows = [], place = null) {
  if (!place) return windows;
  const out = [];
  for (const win of windows) {
    const [ax, ay, bx, by, cx, cy, ex, ey] = win.points, mx = (ax + bx) / 2, my = (ay + by) / 2, ox = mx - (cx + ex) / 2, oy = my - (cy + ey) / 2, tx = place.x - mx, ty = place.y - my;
    const facing = (ox * tx + oy * ty) / Math.max(1e-6, Math.hypot(ox, oy) * Math.hypot(tx, ty)), k = Math.min(1, Math.max(0, (facing + 0.1) / 0.6)), share = k * k * (3 - 2 * k);
    if (share > 0.01) out.push({ ...win, alpha: (win.alpha ?? 1) * share });
  }
  return out;
}
export function windowFlashes({ walls = [], indoors = [], grid = 100, height = 2, foot = 0.2, blocked = () => false } = {}) {
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
    // (A wall hard up against it outside: no flash gets in.)
    if (blocked({ x: mid.x - nx * into * 2, y: mid.y - ny * into * 2 }, { x: mid.x - nx * into * step * 1.6, y: mid.y - ny * into * step * 1.6 })) continue;
    out.push({ points: [ax, ay, bx, by, bx + ox + ux * spread, by + oy + uy * spread, ax + ox - ux * spread, ay + oy - uy * spread], alpha: open.alpha });
  }
  return out;
}

// What light through windows is clipped to on this screen (pure): Foundry's own mask of what the viewer's vision reaches
// past the walls (the shape it clips the lights to), while vision is in force. Null, all shown, for a GM with no token
// selected or in a scene with persistent vision. The fog of war alone does not hide it: explored ground is only half covered.
export function sightClip(cnv) {
  const seen = cnv?.visibility;
  if (!seen?.visible || cnv.visibilityOptions?.persistentVision) return null;
  const mask = seen.vision?.light?.mask;
  return mask && !mask.destroyed ? mask : null;
}
// Puts a layer behind that clip, or takes it out, as vision comes and goes.
export function keepToSight(layer, cnv) {
  if (!layer || layer.destroyed) return;
  const clip = sightClip(cnv);
  if (layer.mask !== clip) layer.mask = clip;
}

// The glows' layer: build({ glows, bounds, alpha, covers }) bakes them, brightest at the opening and fading over the
// ground; its colour is the light's own (warm lamplight where it has none). `covers`: the tree and roof tiles over the
// ground (each { texture, x, y, width, height, rotation, anchorX, anchorY, alpha }), where the glow does not show, their
// leaves and eaves hiding the ground it lies on. Added to `root()` over the lit scene; clear() drops it.
// shadows(creatures) cuts the creatures' shadows out of it (glowShadows), sharp at their feet and softer further out,
// each in its creature's shape (its art's silhouette, flier-silhouette.mjs, laid out from its feet along the wedge);
// art with no outline of its own (a solid portrait) casts the wedge itself. Returns true while a silhouette is still
// being made (call again next frame).
// The longest a creature's shaped shadow is drawn, in its own lengths.
const SHAPE_STRETCH = 2.5;
export function createWindowGlow({ PIXI, root, render }) {
  let casting = new Set();
  let sprite = null, texture = null, shade = null, built = [], frame = null, shadowKey = '', made = null;
  // The creatures' silhouettes, made once per art and kept (made on first use: PIXI is not up when this loads).
  const silhouettes = () => (made ??= typeof PIXI?.Sprite === 'function' && typeof document !== 'undefined' ? createSilhouettes({ PIXI }) : null);
  const drop = () => {
    try { sprite?.parent?.removeChild(sprite); sprite?.destroy(); } catch { /* gone with the canvas */ }
    try { texture?.destroy(true); } catch { /* gone */ }
    try { shade?.destroy(true); } catch { /* gone */ }
    sprite = null; texture = null; shade = null; built = []; frame = null; shadowKey = '';
  };
  const SLICES = 6, WARM = 0xffc27a, GLOW_SLICES = 12;
  return {
    build({ glows = [], bounds, alpha = 1, covers = [], grid = 100 } = {}) {
      drop();
      if (!glows.length || !bounds || !(alpha > 0.01)) return;
      // A window printing its panes in the light is baked at the shafts' finer size, so its lead and frame survive.
      const printed = (glow) => !!glow.panes && typeof PIXI.Graphics.prototype.lineStyle === 'function';
      const fineSize = glows.some(printed), k = Math.min(fineSize ? SHAFT_RESOLUTION : RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k)), soften = k / RESOLUTION;
      const at = (pts) => pts.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k);
      // Shutters' bands kept sharp (their own picture, barely softened), the rest soft.
      const stage = new PIXI.Container(), soft = new PIXI.Graphics(), bands = new PIXI.Graphics();
      soft.filters = [new PIXI.BlurFilter(SOFTNESS * 2 * soften)];
      bands.filters = [new PIXI.BlurFilter(SOFTNESS * 0.5 * soften)];
      const Alpha = PIXI.AlphaFilter ?? PIXI.filters?.AlphaFilter;
      for (const glow of glows) {
        const [ax, ay, bx, by, cx, cy, ex, ey] = glow.points, lerp = (p, q, t) => p + (q - p) * t;
        const tint = glow.color === null || glow.color === undefined ? WARM : glow.color;
        if (printed(glow)) {
          // The window's panes carried out on the lamp's light: coloured glass its colours (taken by the lamp's), the frame,
          // lead or bars cut out of the light, each line softer and fainter the further it lands, as the sun's prints are.
          // Each window in a layer of its own, so cutting its lines never cuts a neighbour's light.
          const holder = new PIXI.Container(), lit = new PIXI.Graphics(), frames = new PIXI.Graphics();
          if (Alpha) holder.filters = [new Alpha(1)];
          lit.filters = [new PIXI.BlurFilter(SOFTNESS * 0.6 * soften)];
          const P = (u, v) => [lerp(lerp(ax, bx, u), lerp(ex, cx, u), v), lerp(lerp(ay, by, u), lerp(ey, cy, u), v)];
          // (Lamplight through coloured glass: dim and warm, a blue pane nearly dark; bright jewel colours want the sun.)
          if (glow.panes === 'mosaic' || glow.panes === 'rose') colouredPanes(lit, { ...glow, panes: glow.panes, alpha: glow.alpha * 0.7 }, P, at, { tint: tinted(tint, LAMP_GLASS), fadeAt: (v) => glowFade(glow, v) });
          // (Through shutters, a band from each gap between the slats with dark between, as the sun's patch has; the leaves'
          // meeting is cut down the middle, wide, so it reads as a pair of shutters.)
          else { const n = glow.slats > 0 ? glow.slats : GLOW_SLICES, on = glow.slats > 0 ? 0.5 : 1; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + on) / n; lit.beginFill(tint, glow.alpha * glowFade(glow, (t0 + t1) / 2)); lit.drawPolygon(at([...P(0, t0), ...P(1, t0), ...P(1, t1), ...P(0, t1)])); lit.endFill(); } }
          frames.blendMode = PIXI.BLEND_MODES.ERASE;
          const long = Math.hypot(ex - ax, ey - ay), fine = glow.panes !== 'cross' && glow.panes !== 'bar', width = Math.max(1.5, grid * k * (0.025 + 0.02 * Math.min(1, long / (grid * 4))) * (fine ? 0.9 : 1)), fades = fine ? 0.45 : 0.7;
          const cut = (u0, v0, u1, v1, wt = 1) => { for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6, v = lerp(v0, v1, (t0 + t1) / 2); frames.lineStyle(Math.max(1, width * wt * (1 + 0.6 * v)), 0xffffff, 0.95 * (1 - fades * v)); frames.moveTo(...at(P(lerp(u0, u1, t0), lerp(v0, v1, t0)))); frames.lineTo(...at(P(lerp(u0, u1, t1), lerp(v0, v1, t1)))); } };
          for (const [u0, v0, u1, v1, wt = 1] of windowPrint(glow.panes, glow.scale, { leaves: glow.leaves })) cut(u0, v0, u1, v1, wt);
          holder.addChild(lit, frames);
          if (glow.clip?.length >= 6) { const mask = new PIXI.Graphics(); mask.beginFill(0xffffff, 1); mask.drawPolygon(at(glow.clip)); mask.endFill(); const kept = new PIXI.Container(); kept.addChild(holder, mask); kept.mask = mask; stage.addChild(kept); }
          else stage.addChild(holder);
          continue;
        }
        // Walls outside stop it as they stop any light: `clip` (flat x, y pairs) is all the light from the opening can reach, and it shows only there.
        let g = glow.slats > 0 ? bands : soft;
        if (glow.clip?.length >= 6) {
          const kept = new PIXI.Container(), mask = new PIXI.Graphics();
          g = new PIXI.Graphics();
          g.filters = [new PIXI.BlurFilter(SOFTNESS * (glow.slats > 0 ? 0.5 : 2) * soften)];
          mask.beginFill(0xffffff, 1); mask.drawPolygon(at(glow.clip)); mask.endFill();
          kept.addChild(g, mask); kept.mask = mask;
          stage.addChild(kept);
        }
        // Through shutters: a band of light from each gap between the slats, with dark between.
        const n = glow.slats > 0 ? glow.slats : GLOW_SLICES, lit = glow.slats > 0 ? 0.5 : 1;
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + lit) / n;
          g.beginFill(tint, glow.alpha * glowFade(glow, (t0 + t1) / 2));
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
    // The creatures standing about ([{ x, y, r, height }], glowShadows, and the walls between them and the lamps): their shadows cut out of the glows, redrawn
    // only when one in a glow has moved.
    // Does this creature cast a shadow here now? One hovering must be drawn again as it bobs; one elsewhere costs nothing.
    casts(id) { return casting.has(id); },
    shadows(creatures = [], walls = []) {
      if (!shade || !frame) return;
      const cast = glowShadows(built, creatures, { walls }), store = silhouettes();
      casting = new Set(cast.map((s) => s.id).filter(Boolean));
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
          // Its top along the light (the container turned to it), its sides kept as its reflection in water keeps them.
          const lay = laidArt({ along, laid: true, rotation: art.rotation });
          figure.rotation = lay.rotation;
          figure.scale.set((((art.width || size) * fit) / shape.width) * (art.flipX ? -1 : 1) * lay.mirror,(((art.height || size) * fit) / shape.height) * (art.flipY ? -1 : 1));
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

// How big a window's panes are (`windowPattern` on a wall, `skyPattern` on a roof opening): 1 as usual, smaller for more
// and finer panes, bigger for fewer and larger.
export const WINDOW_PATTERN = Object.freeze({ min: 0.5, max: 2, usual: 1 });
export const patternScaleOf = (v) => { const n = v === undefined || v === null || v === '' ? NaN : Number(v); return Number.isFinite(n) ? Math.min(WINDOW_PATTERN.max, Math.max(WINDOW_PATTERN.min, n)) : WINDOW_PATTERN.usual; };
// How many panes across for a kind at a pattern size (pure).
export const panesAcross = (usual, scale = 1, least = 2) => Math.max(least, Math.round(usual / patternScaleOf(scale)));
// The glow just inside a window (pure): half an ellipse lying along the wall [x1, y1, x2, y2], reaching a little way into
// the room on the side `inward` points to (any vector that way), flat x, y pairs.
export function windowGlowBand(from, inward, grid = 100) {
  const [x1, y1, x2, y2] = from, len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  let nx = -uy, ny = ux; if (nx * inward[0] + ny * inward[1] < 0) { nx = -nx; ny = -ny; }
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, across = len * 0.6, deep = Math.min(len * 0.35, grid * 0.6), out = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12), c = Math.cos(a), s = Math.sin(a); out.push(mx + ux * across * c + nx * deep * s, my + uy * across * c + ny * deep * s); }
  return out;
}
// How bright a window's patch is along it (pure, `t` 0 at the window – 1 at its far end): brightest by the window, fading as the light spreads.
export const windowFade = (t) => 1 - 0.8 * Math.pow(Math.min(1, Math.max(0, t)), 0.8);
// The lines a window's print cuts across its light (pure): [u0, v0, u1, v1, weight?] each, u across the window, v along the
// light, `weight` how much heavier than the rest (1 when left out). `scale` its pattern size. `leaves`: a window that opens
// is two leaves meeting in the middle: the bar there, a little heavier, and each leaf's panes laid out on their own.
export function windowPrint(kind, scale = 1, { leaves = false } = {}) {
  const out = [];
  // (Frosted glass shows no lines of its own, a rose window keeps its wheel: each only the bar where its leaves meet.)
  if (leaves && (kind === 'rose' || kind === 'frosted')) return [...windowPrint(kind, scale), [0.5, 0, 0.5, 1, 1.8]];
  if (leaves && (kind === 'leaded' || kind === 'mosaic')) {
    const half = windowPrint(kind, scale * 2), squeeze = (u, side) => side * 0.5 + u * 0.5;
    for (const side of [0, 1]) for (const [u0, v0, u1, v1, w] of half) out.push([squeeze(u0, side), v0, squeeze(u1, side), v1, w]);
    out.push([0.5, 0, 0.5, 1, 1.8]);
    return out;
  }
  if (kind === 'cross') out.push([0.5, 0, 0.5, 1], [0, 0.45, 1, 0.45]);
  // (Shutters: where the two leaves meet, a wide dark gap down the light.)
  else if (kind === 'bar') out.push([0.5, 0, 0.5, 1, leaves ? 3 : 1]);
  else if (kind === 'bars') { const n = panesAcross(6, scale); for (let i = 1; i < n; i++) out.push([i / n, 0, i / n, 1]); out.push([0, 0.5, 1, 0.5]); }
  else if (kind === 'lattice') { const n = panesAcross(8, scale); for (let i = 1; i < n; i++) out.push([i / n, 0, i / n, 1], [0, i / n, 1, i / n]); }
  else if (kind === 'leaded') { const n = panesAcross(6, scale); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push([i / n, j / n, (i + 1) / n, (j + 1) / n], [(i + 1) / n, j / n, i / n, (j + 1) / n]); }
  else if (kind === 'mosaic') { const n = panesAcross(6, scale); for (let i = 1; i < n; i++) out.push([i / n, 0, i / n, 1], [0, i / n, 1, i / n]); }
  else if (kind === 'rose') {
    const n = panesAcross(12, scale, 6);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([0.5, 0.5, 0.5 + Math.cos(a) * 0.48, 0.5 + Math.sin(a) * 0.48]); }
    for (const r of [0.13, 0.32, 0.48]) for (let i = 0; i < 24; i++) { const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2; out.push([0.5 + Math.cos(a0) * r, 0.5 + Math.sin(a0) * r, 0.5 + Math.cos(a1) * r, 0.5 + Math.sin(a1) * r]); }
  }
  return out;
}
// The coloured panes' colours, lightened as the sun comes through them.
const JEWELS = [0xe0443a, 0x3f68e8, 0xf6c43a, 0x46b04f, 0xa64ad8, 0xf2843a];
// A flame's light has little blue in it: what a coloured pane passes of it (on top of the light's own colour).
const LAMP_GLASS = 0xffb860;
// A coloured window's panes laid along its light (`P(u, v)` a point of it, `at` into the picture), fading as the light spreads.
// `tint` (0xrrggbb): the light coming through them, each pane's colour taken by it (a warm lamp dulls a blue pane).
const tinted = (c, tint) => (tint === null || tint === undefined ? c : (Math.round(((c >> 16) & 255) * ((tint >> 16) & 255) / 255) << 16) | (Math.round(((c >> 8) & 255) * ((tint >> 8) & 255) / 255) << 8) | Math.round((c & 255) * (tint & 255) / 255));
// `fadeAt(v)`: how bright it is along the light, in place of the sun's patch's windowFade.
export function colouredPanes(g, s, P, at, { fades = true, tint = null, fadeAt = null } = {}) {
  const fade = (v) => s.alpha * (fadeAt ? fadeAt(v) : fades ? windowFade(v) : 1);
  if (s.panes === 'mosaic' && s.leaves) {
    // Two leaves, each its own panes.
    for (const side of [0, 1]) colouredPanes(g, { ...s, leaves: false, scale: (s.scale ?? 1) * 2 }, (u, v) => P(side * 0.5 + u * 0.5, v), at, { fades, tint, fadeAt });
    return;
  }
  if (s.panes === 'mosaic') {
    const n = panesAcross(6, s.scale);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; g.beginFill(tinted(JEWELS[Math.floor((h - Math.floor(h)) * JEWELS.length)], tint), fade((j + 0.5) / n)); g.drawPolygon(at([...P(i / n, j / n), ...P((i + 1) / n, j / n), ...P((i + 1) / n, (j + 1) / n), ...P(i / n, (j + 1) / n)].map((v) => v))); g.endFill(); }
    return;
  }
  // A rose window: wedges round a golden heart (twelve as usual), outside them the light plain.
  const wedges = panesAcross(12, s.scale, 6);
  for (let i = 0; i < wedges; i++) {
    const pts = [...P(0.5, 0.5)];
    for (let k = 0; k <= 4; k++) { const a = ((i + k / 4) / wedges) * Math.PI * 2; pts.push(...P(0.5 + Math.cos(a) * 0.48, 0.5 + Math.sin(a) * 0.48)); }
    g.beginFill(tinted(JEWELS[i % JEWELS.length], tint), fade(0.5)); g.drawPolygon(at(pts)); g.endFill();
  }
  const heart = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; heart.push(...P(0.5 + Math.cos(a) * 0.13, 0.5 + Math.sin(a) * 0.13)); }
  g.beginFill(tinted(0xffe08a, tint), fade(0.5)); g.drawPolygon(at(heart)); g.endFill();
}
// How much of the sun a point indoors gets through the windows (pure, 0–1): the brightest patch of light it stands in
// (windowShafts'), less through shutters' slats, fading toward the patch's far end as the light does.
export function shaftAt(point, shafts = []) { return shaftOf(point, shafts).share; }
// The same, with the patch it stands in (`points`, flat x, y pairs; null in none): its shadow lies only there.
export function shaftOf(point, shafts = []) {
  let best = 0, points = null;
  for (const s of shafts) {
    if (!inside(point, s.points)) continue;
    const [ax, ay, bx, by, cx, cy, ex, ey] = s.points, nx = (ax + bx) / 2, ny = (ay + by) / 2, fx = (cx + ex) / 2, fy = (cy + ey) / 2, len = Math.hypot(fx - nx, fy - ny) || 1;
    const along = Math.min(1, Math.max(0, ((point.x - nx) * (fx - nx) + (point.y - ny) * (fy - ny)) / (len * len)));
    const share = s.alpha * (s.slats > 0 ? 0.5 : 1) * (1 - 0.5 * along);
    if (share > best) { best = share; points = s.points; }
  }
  return { share: best, points };
}
// How dark a room the low sun shines into goes at sunset, at most.
export const DUSK_DIM = 0.45;
// How low the sun is, 0 high – 1 on the horizon (pure): the rooms dim and the windows glow from about 40° down to 6°.
export const duskOf = (sun) => { if (!sun || sun.moon) return 0; const h = Number(sun.height) || 45, t = Math.min(1, Math.max(0, (40 - h) / 34)); return t * t * (3 - 2 * t); };
// The light's colour at sunset (pure, [r, g, b] 0–1): toward pink once the sun is under about 12°.
export const sunsetTint = (rgb, sun) => { const h = Number(sun?.height) || 45, k = sun?.moon ? 0 : 0.35 * Math.min(1, Math.max(0, (12 - h) / 9)), pink = [1, 0.42, 0.45]; return rgb.map((v, i) => v + (pink[i] - v) * k); };
// The shafts' layer: build({ shafts, bounds, indoors (the roofs, as for the shadows), color (0xrrggbb), alpha }) bakes
// them, brightest at the opening and spreading fainter across the floor, kept only under the roofs, with dust drifting
// in them; tick(seconds) moves the dust; clear() drops them. Added to `root()` over the lit scene.
export function createWindowShafts({ PIXI, root, render }) {
  let sprite = null, texture = null, motes = null, clock = 0, dimSprite = null, dimTexture = null;
  const drop = () => {
    // (The dust's clock outlasts the bake: the shafts follow the sun each minute, and the motes carry on where they are.)
    if (motes && !motes.destroyed) clock = motes.shader.uniforms.uTime;
    try { dimSprite?.parent?.removeChild(dimSprite); dimSprite?.destroy(); dimTexture?.destroy(true); } catch { /* gone */ } dimSprite = null; dimTexture = null;
    try { sprite?.parent?.removeChild(sprite); sprite?.destroy(); } catch { /* gone with the canvas */ }
    try { motes?.parent?.removeChild(motes); motes?.destroy(); } catch { /* gone with the canvas */ }
    try { texture?.destroy(true); } catch { /* gone */ }
    sprite = null; texture = null; motes = null;
  };
  const SLICES = 6;
  return {
    // `dusk` 0–1: how low the sun is, deepening the rooms it shines into and the glow at their windows.
    build({ shafts = [], bounds, indoors = [], color = 0xfff2d8, alpha = 1, grid = 100, dusk = 0 } = {}) {
      drop();
      if (!shafts.length || !indoors.length || !bounds || !(alpha > 0)) return;
      // Twice the walls' detail: a rose window's wedges and a leaded window's net, its lead lines and its colours, survive the bake.
      const k = Math.min(SHAFT_RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      const at = (p) => p.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k);
      const stage = new PIXI.Container(), g = new PIXI.Graphics(), colour = new PIXI.Graphics(), fog = new PIXI.Graphics();
      // Each patch in slices from the opening out, fading as the light spreads.
      for (const s of shafts) {
        const [ax, ay, bx, by, cx, cy, ex, ey] = s.points, lerp = (p, q, t) => p + (q - p) * t;
        // Coloured panes (mosaic, a rose window): each its own colour, lit by the sun (the layer is tinted by it); frosted glass: a soft glow, no sharp patch.
        const P = (u, v) => [lerp(lerp(ax, bx, u), lerp(ex, cx, u), v), lerp(lerp(ay, by, u), lerp(ey, cy, u), v)];
        if (s.panes === 'mosaic' || s.panes === 'rose') { colouredPanes(colour, s, P, at); continue; }
        if (s.soft) { fog.beginFill(0xffffff, s.alpha * 0.8); fog.drawPolygon(at(s.points)); fog.endFill(); continue; }
        // (Through shutters: a band from each gap between the slats, with dark between.)
        const n = s.slats > 0 ? s.slats : SLICES, lit = s.slats > 0 ? 0.5 : 1;
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + lit) / n;
          g.beginFill(0xffffff, s.alpha * windowFade((i + 0.5) / n));
          g.drawPolygon(at([lerp(ax, ex, t0), lerp(ay, ey, t0), lerp(bx, cx, t0), lerp(by, cy, t0), lerp(bx, cx, t1), lerp(by, cy, t1), lerp(ax, ex, t1), lerp(ay, ey, t1)]));
          g.endFill();
        }
        // The light that runs into the far wall: a bright band along its foot.
        if (s.wall && typeof g.lineStyle === 'function') { const [wx1, wy1, wx2, wy2] = at(s.wall.points); g.lineStyle(Math.max(1, grid * k * (0.12 + 0.15 * s.wall.share)), 0xffffff, Math.min(1, s.alpha * (0.5 + 0.6 * s.wall.share))); g.moveTo(wx1, wy1); g.lineTo(wx2, wy2); g.lineStyle(0); }
        // A glow just inside the window, more as the sun goes down: a low band hugging the wall, the window's width across.
        if (s.from) { g.beginFill(0xffffff, s.alpha * (0.1 + 0.25 * dusk)); g.drawPolygon(at(windowGlowBand(s.from, [(cx + ex - ax - bx) / 2, (cy + ey - ay - by) / 2], grid))); g.endFill(); }
      }
      // What fills each window printed in its light, cut out of it: a frame's cross or bar, lead between coloured panes, a
      // diamond net, a lattice's grid, a cell's bars.
      const frames = new PIXI.Graphics(); frames.blendMode = PIXI.BLEND_MODES.ERASE;
      if (typeof frames.lineStyle === 'function') for (const s of shafts) {
        if (!s.panes) continue;
        const [ax, ay, bx, by, cx, cy, ex, ey] = s.points, lerp = (p, q, t) => p + (q - p) * t, long = Math.hypot(ex - ax, ey - ay);
        // A frame's shadow is thin, and the further it lands from the window the softer and fainter it is: each line laid in
        // short pieces, narrower and lighter along the light.
        // (A net of lead or a lattice is many lines close together: each keeps its weight and fades less, or the net blurs away.)
        const fine = s.panes === 'leaded' || s.panes === 'lattice' || s.panes === 'mosaic' || s.panes === 'rose', width = Math.max(1.5, grid * k * (0.025 + 0.02 * Math.min(1, long / (grid * 4))) * (fine ? 0.9 : 1)), fades = fine ? 0.45 : 0.7;
        const P = (u, v) => at([lerp(lerp(ax, bx, u), lerp(ex, cx, u), v), lerp(lerp(ay, by, u), lerp(ey, cy, u), v)]);
        const cut = (u0, v0, u1, v1, w = 1) => { const pieces = 6; for (let i = 0; i < pieces; i++) { const t0 = i / pieces, t1 = (i + 1) / pieces, v = lerp(v0, v1, (t0 + t1) / 2); frames.lineStyle(Math.max(1, width * w * (1 + 0.6 * v)), 0xffffff, 0.95 * (1 - fades * v)); frames.moveTo(...P(lerp(u0, u1, t0), lerp(v0, v1, t0))); frames.lineTo(...P(lerp(u0, u1, t1), lerp(v0, v1, t1))); } };
        for (const [u0, v0, u1, v1, w = 1] of windowPrint(s.panes, s.scale, { leaves: s.leaves })) cut(u0, v0, u1, v1, w);
      }
      // Only under the roofs.
      const roofs = new PIXI.Graphics();
      for (const p of indoors) { roofs.beginFill(0xffffff, 1); roofs.drawPolygon(at(p)); for (const hole of p.holes ?? []) { roofs.beginHole(); roofs.drawPolygon(at(hole)); roofs.endHole(); } roofs.endFill(); }
      fog.filters = [new PIXI.BlurFilter(Math.max(2, grid * k * 0.45))];
      const lit = new PIXI.Container(); lit.addChild(g, colour, fog, frames); lit.mask = roofs;
      stage.addChild(lit, roofs);
      // (As soft on the map as before, the picture being finer.)
      // (Soft enough to read as light, never so soft its frame's lines blur away.)
      stage.filters = [new PIXI.BlurFilter(SOFTNESS * 0.75 * (k / SHAFT_RESOLUTION))];
      texture = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      // The rooms the sun shines into go dim as it gets low, so its light through their windows blazes against them.
      if (dusk > 0.02 && typeof PIXI.Graphics === 'function') {
        const lit = indoors.filter((p) => shafts.some((s) => inside({ x: (s.points[0] + s.points[2]) / 2 + (s.points[6] - s.points[0]) * 0.02, y: (s.points[1] + s.points[3]) / 2 + (s.points[7] - s.points[1]) * 0.02 }, p)));
        if (lit.length) {
          const dim = new PIXI.Container(), fill = new PIXI.Graphics();
          for (const p of lit) { fill.beginFill(0xffffff, 1); fill.drawPolygon(at(p)); for (const hole of p.holes ?? []) { fill.beginHole(); fill.drawPolygon(at(hole)); fill.endHole(); } fill.endFill(); }
          // (Only a soft fill: baked at the walls' coarser size, a quarter the memory of the light's.)
          const dk = k * (RESOLUTION / SHAFT_RESOLUTION), dw = Math.max(1, Math.ceil(bounds.width * dk)), dh = Math.max(1, Math.ceil(bounds.height * dk));
          fill.scale.set(dk / k); dim.addChild(fill); dim.filters = [new PIXI.BlurFilter(Math.max(2, grid * dk * 0.25))];
          dimTexture = PIXI.RenderTexture.create({ width: dw, height: dh });
          try { render(dim, dimTexture); } finally { try { dim.destroy({ children: true }); } catch { /* drawn */ } }
          dimSprite = new PIXI.Sprite(dimTexture); dimSprite.eventMode = 'none'; dimSprite.tint = 0x0e0a18; dimSprite.alpha = DUSK_DIM * dusk;
          dimSprite.position.set(bounds.x, bounds.y); dimSprite.scale.set(1 / dk, 1 / dk);
          root().addChild(dimSprite);
        }
      }
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
        motes = new PIXI.Mesh(geometry, PIXI.Shader.from(MOTES_VERT, MOTES_FRAG, { uShafts: texture, uSize: [b.width, b.height], uColor: [c.red, c.green, c.blue], uTime: clock, uGrid: grid, uAlpha: Math.min(1, alpha * 1.4) }));
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

// The rooms cut out of a picture (`at` maps a polygon into it): each fading in over as much of its edge as it says
// (`soft` on the polygon, in squares; region-steps.mjs indoorEdgeOf), `perSquare` a square in the picture's pixels. A list
// of erasing shapes to add to what they cut from.
export function eraseRooms(PIXI, rooms, at, perSquare) {
  const hard = new PIXI.Graphics(), out = [hard];
  hard.blendMode = PIXI.BLEND_MODES.ERASE;
  for (const p of rooms) {
    const r = (Number(p.soft) || 0) * perSquare * 0.5, g = r > 0.5 ? new PIXI.Graphics() : hard;
    g.beginFill(0xffffff, 1); g.drawPolygon(at(p)); for (const hole of p.holes ?? []) { g.beginHole(); g.drawPolygon(at(hole)); g.endHole(); } g.endFill();
    if (g !== hard) { const blur = new PIXI.BlurFilter(r, 4); blur.blendMode = PIXI.BLEND_MODES.ERASE; g.filters = [blur]; out.push(g); }
  }
  return out;
}

// How far an opening's edge may fade (pure, in the same units as its points): never past a quarter of its narrower side,
// so however soft it is asked to be, its middle still lets the whole sun and the whole cloud's shadow through.
export const openingFade = (points, want) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i + 1 < points.length; i += 2) { x0 = Math.min(x0, points[i]); x1 = Math.max(x1, points[i]); y0 = Math.min(y0, points[i + 1]); y1 = Math.max(y1, points[i + 1]); } const side = Math.min(x1 - x0, y1 - y0); return Number.isFinite(side) ? Math.max(0, Math.min(want, side * 0.25)) : 0; };
// What is open to the sky drawn back in (as eraseRooms, but adding): the sun reaches through a hole in a roof.
export function openRooms(PIXI, open, at, perSquare) {
  const hard = new PIXI.Graphics(), out = [hard];
  for (const p of open) {
    const r = openingFade(at(p), (Number(p.soft) || 0) * perSquare * 0.5), g = r > 0.5 ? new PIXI.Graphics() : hard;
    g.beginFill(0xffffff, 1); g.drawPolygon(at(p)); g.endFill();
    if (g !== hard) { g.filters = [new PIXI.BlurFilter(r, 4)]; out.push(g); }
  }
  return out;
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
    // `tops`: raised ground ([{ areas: [flat x, y, �], height: squares up from the floor }]): a wall no taller throws no shadow onto
    // it, and the sun stays on it. (Roi: "a wall which is 0-10 and the slope is 40 ft yet the wall shadow is on its top?")
    // (`wallTop`: the tallest wall's top over the floor, standing on its own ground, when the caller knows it.)
    build({ quads = [], bounds, alpha = 1, indoors = [], open = [], grid = 100, tops = [], wallTop = null } = {}) {
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
      if (indoors.length) g.addChild(...eraseRooms(PIXI, indoors, at, grid * k));
      const tallest = Number.isFinite(wallTop) ? wallTop : quads.reduce((m, q) => Math.max(m, Number.isFinite(q.top) ? q.top : Infinity), 0), above = tops.filter((t) => t?.height >= tallest && t.areas?.length);
      const onTops = (color, blend) => { const c = new PIXI.Graphics(); if (blend) c.blendMode = blend; c.beginFill(color, 1); for (const t of above) for (const a of t.areas) c.drawPolygon(at(Array.from(a))); c.endFill(); return c; };
      if (above.length) g.addChild(onTops(0xffffff, PIXI.BLEND_MODES.ERASE));
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
      lit.addChild(shade, ...eraseRooms(PIXI, indoors, at, grid * k), ...openRooms(PIXI, open, at, grid * k), ...(above.length ? [onTops(0xffffff, null)] : []));
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

// What it draws with, for warming ahead of the first frame (scene-shaders.mjs).
export const WINDOW_SHADER_SOURCES = Object.freeze([[MOTES_VERT, GLOW_FRAG], [MOTES_VERT, MOTES_FRAG]]);
