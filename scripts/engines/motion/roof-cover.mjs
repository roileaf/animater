// A roof covered with a picture of roofing the GM owns.
//
// An asset pack does not hold roofs: it holds roofing — a square of pantile, of slate, of thatch, painted far better
// than ours and meant to be laid over whatever shape a roof is. So the shape stays ours (roof-paint.mjs: its form, its
// slopes, its ridge, which way each slope faces the sun, where its chimney stands, what the weather leaves on it) and
// only the covering is theirs: laid on each slope with its courses running along that slope's eave, as a roofer lays
// them. Nothing of anyone's art is held here: a picture is read from where the GM keeps it and kept only in memory.
//
// (Roi, of the pack's pictures beside our painted ones: "i still see huge distinction between the quality"; of roofs:
// "maybe we can integrate with their assets for buildings too?" — "but will it support our roof engine with
// sun\weather\states?" It does because the roof is still our roof.)
//
// Pure, but for the loader at the end, which is handed everything it touches.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hex2 = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');

/**
 * How far down a roofing picture is roofing (pure): such a picture ends in a ragged eave with nothing under it, and
 * that edge is what should land on the roof's own eave. `rgba` its pixels, row by row. The last row of which most
 * is painted; the whole height for a picture painted to its bottom.
 */
export function coverSolidTo(rgba, w, h) {
  for (let y = h - 1; y > 0; y--) {
    let on = 0;
    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 64))) if (rgba[(y * w + x) * 4 + 3] > 200) on++;
    if (on >= Math.min(64, w) * 0.85) return y + 1;
  }
  return h;
}

/** The colour of a roofing picture taken all together (pure), as '#rrggbb': what its ridge and hips are capped in. */
export function coverBase(rgba, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 4096)));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) { const i = (y * w + x) * 4; if (rgba[i + 3] < 200) continue; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++; }
  return n ? `#${hex2(r / n)}${hex2(g / n)}${hex2(b / n)}` : '#8a7f6c';
}

/**
 * Where the wall is in a picture of a strip of wall (pure): such a picture is a long band of wall across its middle
 * with nothing above or below. [top, bottom) in its rows; the whole height for a picture that is wall all through.
 */
export function coverBand(rgba, w, h) {
  const cols = []; for (let i = 1; i <= 16; i++) cols.push(Math.min(w - 1, Math.floor((w * i) / 17)));
  const on = (y) => cols.filter((x) => rgba[(y * w + x) * 4 + 3] > 128).length >= cols.length * 0.6;
  let top = 0, bottom = h - 1;
  while (top < bottom && !on(top)) top++;
  while (bottom > top && !on(bottom)) bottom--;
  return on(top) ? [top, bottom + 1] : [0, h];
}

/**
 * Where a picture of a window shut comes apart (pure): such a picture is a pane across its middle with a jamb at
 * each end, and a jamb stands taller across the wall than the pane does. { x0, x1 } the columns it is painted from
 * and to (x1 past the last), { a, b } where its left jamb ends and its right one begins, `tall` the most rows any
 * column of it is painted. A picture with no jambs to find answers a = x0 and b = x1: all pane.
 */
export function coverJambs(rgba, w, h) {
  const tall = new Array(w).fill(0); let x0 = w, x1 = -1, most = 0;
  for (let x = 0; x < w; x++) { let n = 0; for (let y = 0; y < h; y++) if (rgba[(y * w + x) * 4 + 3] > 128) n++; tall[x] = n; if (n) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); most = Math.max(most, n); } }
  if (x1 < x0) return { x0: 0, x1: w, a: 0, b: w, tall: h };
  const span = x1 - x0, mid = tall.slice(Math.round(x0 + span * 0.3), Math.round(x0 + span * 0.45) + 1).sort((p, q) => p - q), pane = Math.max(1, mid[Math.floor(mid.length / 2)] || 1);
  // (Looked for within the outer quarter at each end, from the inside out: a jamb's own outer edge is thin and soft.)
  const q = Math.round(span * 0.25); let a = x0, b = x1 + 1;
  for (let x = x0 + q; x >= x0; x--) if (tall[x] > pane * 1.35) { a = x + 1; break; }
  for (let x = x1 - q; x <= x1; x++) if (tall[x] > pane * 1.35) { b = x; break; }
  return { x0, x1: x1 + 1, a, b, tall: most };
}

/** How many of a roofing picture's pixels make one grid square, unless the roof says otherwise: the packs' own scale. */
export const COVER_PER_SQUARE = 200;

/**
 * Where a roofing picture is laid on one slope (pure). `face` { pts, away } as roof-paint.mjs makes them (`away`: the
 * way the slope falls, toward its eave); `cover` { width, height, solidTo, per }; `unit` a grid square in pixels.
 * Returns { rot, cols: [x…], rows: [y…], w, h } — turn the drawing by `rot` and draw the whole picture `w` by `h` at
 * each (x, y): the first row's ragged bottom lies on the eave, each row above laps the one below a little, and the
 * columns run the slope's whole width.
 */
export function coverCourses(face, cover, unit = 100) {
  const [ax, ay] = face.away, rot = Math.atan2(ay, ax) - Math.PI / 2, cs = Math.cos(-rot), sn = Math.sin(-rot);
  const local = face.pts.map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]);
  const x0 = Math.min(...local.map((p) => p[0])), x1 = Math.max(...local.map((p) => p[0])), y0 = Math.min(...local.map((p) => p[1])), y1 = Math.max(...local.map((p) => p[1]));
  const k = unit / Math.max(1, Number(cover.per) || COVER_PER_SQUARE), w = cover.width * k, h = cover.height * k, solid = Math.max(1, Math.min(cover.height, Number(cover.solidTo) || cover.height)) * k;
  const cols = [], rows = [];
  for (let x = Math.floor(x0 / w) * w; x < x1 && cols.length < 400; x += w) cols.push(x);
  for (let y = y1 - solid; y > y0 - solid && rows.length < 400; y -= solid * 0.96) rows.push(y);
  return { rot, cols, rows, w, h };
}

/**
 * The roofing pictures a scene's roofs are covered with, read once each and kept. `load(src)` gives a drawable (a
 * promise of one); `read(image)` its pixels { data, width, height }; `changed()` is told when one that was asked for
 * has arrived, so the roofs waiting on it can be painted again. `get(src)` answers at once: the picture ready to lay
 * ({ image, width, height, solidTo, base, per }), or null while it is on its way or when it cannot be had.
 */
export const createCovers = (given) => createRoofCovers(given);
export function createRoofCovers({ load, read, changed = () => {}, most = 24 } = {}) {
  const kept = new Map();
  return {
    get(src) {
      if (typeof src !== 'string' || !src) return null;
      const had = kept.get(src);
      if (had) return had.cover ?? null;
      if (kept.size >= most) kept.delete(kept.keys().next().value);
      const entry = { cover: null, failed: false }; kept.set(src, entry);
      Promise.resolve().then(() => load(src)).then((image) => {
        const px = read(image); if (!px?.data || !(px.width > 0) || !(px.height > 0)) throw new Error('unreadable');
        entry.cover = { image, width: px.width, height: px.height, solidTo: coverSolidTo(px.data, px.width, px.height), band: coverBand(px.data, px.width, px.height), jambs: coverJambs(px.data, px.width, px.height), base: coverBase(px.data, px.width, px.height), per: COVER_PER_SQUARE };
        changed(src);
      }).catch(() => { entry.failed = true; });
      return null;
    },
    /** 'ready', 'loading', 'failed' or 'none': for the roof's key, so it is painted again when its covering arrives. */
    state(src) { const had = kept.get(src); return !src ? 'none' : had?.cover ? 'ready' : had?.failed ? 'failed' : 'loading'; },
    clear() { kept.clear(); },
  };
}
