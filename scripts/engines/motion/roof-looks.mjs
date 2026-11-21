// Which rooms have roofs, what each roof is, and how the year and the weather sit on it. Pure: it is handed plain
// wall records and plain roof records and gives back plain answers. The art is roof-paint.mjs; putting the pictures
// on the map is painted-roofs.mjs.
//
// A roof is laid by clicking inside a room, so the first thing here is finding the room: walk the squares out from
// where the GM clicked, never crossing a wall, and see what that reaches. If it reaches the edge of the map it was
// not a room at all — it was the outdoors — and nothing is roofed.

import { ROOF_IDS, ROOF_FORM_IDS, ROOF_OVERHANG, formFor, formFits, roofFor, roofShape } from './roof-paint.mjs';

/** How steeply a roof climbs from its eaves to its ridge: squares of rise for each square of half-span. */
// As steep as it is wide, the pitch of thatch and of old slate. At six tenths the peak's shadow only cleared the
// eaves' own with the sun under thirty degrees, so a hipped roof and a pyramid threw a plain box all day and their
// shape showed in nobody's shadow (Roi, shown the sheet of them: "all roof shadow will be rectangle though?").
export const ROOF_PITCH = 1;
/** The most a ridge stands over its eaves, in squares: a great hall's roof is tall, but it is not a spire. */
export const ROOF_RISE_MOST = 4;

/**
 * What a roof throws a shadow from, as the wall shadows understand it: plain `{ c, top }` records, heights in
 * squares. A building's shadow is the roof's — the eaves hang past the walls and the ridge stands over both — so
 * the eave ring casts from the height of the walls under it and the ridge from its own height above them. Handed to
 * the same caster as the walls, the building then has ONE shadow, as long as the hour makes it, where it used to
 * have the walls' and a second painted into the roof's own picture that never moved (Roi: "why theres a roof shadow
 * and wall shadow and why the roof shadow is stronger?").
 */
export function roofShadowEdges(roofs = [], { grid = 100, wallTall = 2 } = {}) {
  const out = [];
  for (const roof of roofs ?? []) {
    const room = roof?.room;
    if (!room || !(room.w > 0) || !(room.h > 0) || !(grid > 0)) continue;
    let shape = null;
    try { shape = roofShape(roof.form, room.x, room.y, room.w, room.h, grid * ROOF_OVERHANG, roof.high); } catch { shape = null; }
    const eave = shape?.eave;
    if (!Array.isArray(eave) || eave.length < 3) continue;
    const edge = (a, b, top) => { if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1) out.push({ c: [a[0], a[1], b[0], b[1]], top, light: 20, move: 20, sight: 20, roof: roof.id }); };
    const eaves = eavesAt(wallTall, roof);
    for (let i = 0; i < eave.length; i++) edge(eave[i], eave[(i + 1) % eave.length], eaves);
    // The ridge, over the middle: half the short side out from the eaves, climbing at the roof's pitch.
    const rise = Math.min(ROOF_RISE_MOST, (Math.min(room.w, room.h) / 2 / grid) * ROOF_PITCH);
    const ridge = shape?.ridge;
    if (Array.isArray(ridge) && ridge.length >= 2 && rise > 0) edge(ridge[0], ridge[1], eaves + rise);
  }
  return out;
}

/**
 * The whole shadow of each roof, as one shape (flat x,y pairs), for a sun that way and that high.
 *
 * The edges above throw a shadow each, and laid together they are not the roof's: the eaves give one block, the
 * ridge another further out, and nothing joins them, so a roof came out with steps in its shade; a pyramid and a
 * cone have a point and no ridge at all, so theirs was a flat-topped box (Roi, of a pyramid's stepped shadow: "are
 * we sure that the shape of the shadow matches the roof shape for all roof shapes?"). Every roof here is a solid
 * with no hollows in it, and the shadow of such a thing is exactly the outline round the shadows of its corners:
 * the eaves where they stand, the eaves thrown from the height of the walls, and the ridge ends or the point thrown
 * from their own height. So that is what is drawn, whatever the form.
 */
export function roofShadows(roofs = [], { grid = 100, wallTall = 2, sun = null, reach = null } = {}) {
  if (!sun || !(Number(sun.strength) > 0) || typeof reach !== 'function' || !(grid > 0)) return [];
  const away = ((Number(sun.angle) || 0) + 180) * Math.PI / 180, dx = Math.cos(away), dy = Math.sin(away);
  const out = [];
  for (const roof of roofs ?? []) {
    const room = roof?.room;
    if (!room || !(room.w > 0) || !(room.h > 0)) continue;
    let shape = null;
    try { shape = roofShape(roof.form, room.x, room.y, room.w, room.h, grid * ROOF_OVERHANG, roof.high); } catch { shape = null; }
    const eave = shape?.eave;
    if (!Array.isArray(eave) || eave.length < 3) continue;
    const eaves = eavesAt(wallTall, roof), rise = Math.min(ROOF_RISE_MOST, (Math.min(room.w, room.h) / 2 / grid) * ROOF_PITCH), top = eaves + rise;
    const low = reach(eaves, sun.height) * grid, high = reach(top, sun.height) * grid;
    const pts = [];
    for (const p of eave) pts.push([p[0], p[1]], [p[0] + dx * low, p[1] + dy * low]);
    for (const p of [...(Array.isArray(shape.ridge) ? shape.ridge : []), shape.peak].filter(Array.isArray)) pts.push([p[0] + dx * high, p[1] + dy * high]);
    const hull = outline(pts);
    if (hull.length >= 3) out.push({ points: hull.flat(), alpha: 1, top, bottom: 0, roof: roof.id });
  }
  return out;
}

/**
 * How high a roof's eaves stand, in squares. A roof sits on its walls, so it is the height of the walls under it,
 * and the caller may say that roof by roof (`wallTall` as a function of the roof). Told one height for the whole
 * map while the walls stood at their own — a level's ceiling, twice as high — the walls threw a shadow out past
 * the eaves', and a house had a narrow block of shade standing on a wide one.
 */
function eavesAt(wallTall, roof) {
  const n = Number(typeof wallTall === 'function' ? wallTall(roof) : wallTall);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

/**
 * The height of the walls under a roof, from the shadows those walls already throw (`quads`, wall-shadows.mjs's:
 * each with the wall's line `c` and its `top`): the tallest wall standing inside the roof's room, or `usual` when
 * none does.
 */
export function wallsUnder(roof, quads = [], { grid = 100, usual = 2 } = {}) {
  const r = roof?.room;
  if (!r) return usual;
  const slack = grid * 0.6, within = (x, y) => x >= r.x - slack && x <= r.x + r.w + slack && y >= r.y - slack && y <= r.y + r.h + slack;
  let most = 0;
  for (const q of quads ?? []) { const c = q?.c; if (Array.isArray(c) && Number(q.top) > most && within(c[0], c[1]) && within(c[2], c[3])) most = Number(q.top); }
  return most > 0 ? most : usual;
}

/** The outline round a handful of points (their convex hull), in order. */
function outline(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => { const h = []; for (const q of list) { while (h.length >= 2 && turn(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  return [...half(p), ...half([...p].reverse())];
}

/**
 * The floor a roof keeps the sky off, as flat x,y pairs: the room, not the roof, since a roof hangs past its walls
 * and the rain stops at the wall. A round tower's floor is round. It used to be handed over as the tower's box, and
 * the four corners of that box stand outside the tower: the sun's shadow was cut away there as if it were indoors,
 * leaving a square bite in the shadow of a round roof (Roi's picture of it, a cone with a corner missing from its
 * shade).
 */
export function roofFloor(roof, { sides = 28 } = {}) {
  const r = roof?.room;
  if (!r || !(r.w > 0) || !(r.h > 0)) return null;
  if (roof.form !== 'cone') return [r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h];
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.min(r.w, r.h) / 2, out = [];
  for (let i = 0; i < sides; i++) { const a = (i / sides) * Math.PI * 2; out.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
  return out;
}

/** The most squares a room may be before we call it the outdoors and give up. */
export const ROOM_MOST = 4000;

/** Does the segment a→b cross the segment c→d? (Pure, and only needs to know whether, not where.) */
export function crosses(a, b, c, d) {
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const s1 = side(a, b, c), s2 = side(a, b, d), s3 = side(c, d, a), s4 = side(c, d, b);
  return s1 !== s2 && s3 !== s4;
}

/**
 * The room a point is in: the squares it can reach without crossing a wall, as a box in pixels. `walls` are
 * [{ c: [x1, y1, x2, y2] }] — every wall that stops movement, painted or not, since a room is a room whoever
 * built it. Returns null when the point is not enclosed, or the space is bigger than `most` squares.
 */
export function roomAt(point, walls, { grid = 100, bounds = null, most = ROOM_MOST } = {}) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !(grid > 0)) return null;
  const segs = (walls ?? []).filter((w) => Array.isArray(w?.c) && w.c.length >= 4).map((w) => [[w.c[0], w.c[1]], [w.c[2], w.c[3]]]);
  const cell = (x, y) => [Math.floor(x / grid), Math.floor(y / grid)];
  const middle = (cx, cy) => [cx * grid + grid / 2, cy * grid + grid / 2];
  const start = cell(point.x, point.y);
  const seen = new Set([`${start[0]},${start[1]}`]);
  const queue = [start];
  let x0 = start[0], x1 = start[0], y0 = start[1], y1 = start[1], n = 0;
  const outside = (cx, cy) => {
    if (!bounds) return false;
    const [mx, my] = middle(cx, cy);
    return mx < bounds.x || my < bounds.y || mx > bounds.x + bounds.w || my > bounds.y + bounds.h;
  };
  while (queue.length) {
    if (++n > most) return null;
    const [cx, cy] = queue.shift();
    if (outside(cx, cy)) return null;
    const from = middle(cx, cy);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      const to = middle(nx, ny);
      if (segs.some(([a, b]) => crosses(from, to, a, b))) continue;
      seen.add(key);
      queue.push([nx, ny]);
      if (nx < x0) x0 = nx; if (nx > x1) x1 = nx;
      if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
    }
  }
  return { x: x0 * grid, y: y0 * grid, w: (x1 - x0 + 1) * grid, h: (y1 - y0 + 1) * grid, squares: seen.size };
}

/** Is a point inside a roof's box? (What decides whether a roof fades for whoever is standing there.) */
export const under = (roof, x, y) => !!roof && x >= roof.x && y >= roof.y && x <= roof.x + roof.w && y <= roof.y + roof.h;

/**
 * The roofs a scene holds, as its flags keep them, cleaned up. A roof is kept by the scene rather than drawn as a
 * tile: Animater paints it, so there is no image file to make, and nothing to tidy away if the feature is turned off.
 */
export function roofsOf(scene = {}, { grid = 100 } = {}) {
  const list = Array.isArray(scene?.roofs) ? scene.roofs : [];
  return list.map((r, i) => {
    const room = { x: Number(r?.x), y: Number(r?.y), w: Number(r?.w), h: Number(r?.h) };
    if (![room.x, room.y, room.w, room.h].every(Number.isFinite) || !(room.w > 0) || !(room.h > 0)) return null;
    const kind = ROOF_IDS.includes(r?.kind) ? r.kind : roofFor(r?.material);
    // A form the room cannot take is not drawn: it falls back to the one that fits, rather than leaving the corners
    // of a long house open to the sky.
    const asked = ROOF_FORM_IDS.includes(r?.form) ? r.form : null;
    // A cone has to say for itself that the room under it was round when it was laid. Only the box is kept here,
    // and a square room's box is a cone's box, so a cone that says nothing is a cone that was put somewhere it did
    // not belong — which is exactly what was on the map. It takes the shape that fits instead.
    const fits = asked === 'cone' ? r?.round === true : !!asked && formFits(asked, room, { grid });
    const form = fits ? asked : formFor(room, { grid });
    const age = Math.max(0, Math.min(1, Number(r?.age) || 0));
    // The colour the GM painted it in, if any: a village of red pantiles and one grey slate hall.
    const tint = typeof r?.tint === 'string' && /^#[0-9a-f]{3,8}$/i.test(r.tint) ? r.tint : null;
    return {
      id: r?.id ?? `roof${i}`,
      key: `${r?.id ?? i}:${kind}:${form}:${Math.round(room.x)},${Math.round(room.y)},${Math.round(room.w)},${Math.round(room.h)}:${Math.round(age * 100)}:${r?.chimney ?? ''}:${r?.dressed ? 'd' : ''}${tint ? `:${tint}` : ''}`,
      room, kind, form, age, tint,
      chimney: r?.chimney === 'stone' || r?.chimney === 'brick' ? r.chimney : null,
      chimneyAt: Number.isFinite(Number(r?.chimneyAt)) ? Number(r.chimneyAt) : 0.6,
      high: r?.high,
      dressed: r?.dressed === true,
      // What a dressed building hangs out is its own, kept with it like its chimney and its colour.
      hangs: typeof r?.hangs === 'string' ? r.hangs : 'garlands',
    };
  }).filter(Boolean);
}

/**
 * How the year and the weather sit on a roof. A roof is out in it, so it takes more than a wall does: snow lies on
 * it, leaves gather at its eaves in autumn, rain darkens it, and moss comes with the years.
 */
export function roofLook(scene = {}, { season = null, age = 0 } = {}) {
  const years = Math.max(0, Math.min(1, Number(age) || 0));
  const growing = season === 'summer' || season === 'spring' ? 1 : season === 'autumn' ? 0.7 : season === 'winter' ? 0 : 0.85;
  return {
    // What is lying on the ground is lying on the roof. The snow used to be worked out from the calendar alone,
    // which left bare slate over a snowed-in map whenever the season said otherwise; the amount the scene is
    // actually carrying wins, and the season only answers when nothing says.
    snow: Math.max(0, Math.min(1, Number.isFinite(Number(scene?.snow)) ? Number(scene.snow) : (season === 'winter' ? 0.9 : 0))),
    // Moss is what the years put there, as on the walls; the season only says how well it is doing.
    moss: Math.min(1, years * growing),
    leaves: season === 'autumn' ? 0.8 : 0,
    wet: Math.max(0, Math.min(1, Number(scene?.wet) || 0)),
    soot: Math.max(0, Math.min(1, Number(scene?.soot) || 0)),
  };
}
