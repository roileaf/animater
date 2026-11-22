// Any picture as a decoration the engines can work on.
//
// A painter here can say what each part of its piece is — how high it stands, how it shines (decor-kit.mjs). A picture
// someone else painted says nothing: it is colours and an outline. This reads out of those colours what the engines
// need, so that a GM's own art (an asset pack they own, a drawing of theirs) can stand on the map and cast a shadow
// that moves with the sun, take the light of a torch on its near side, lie under snow, darken in rain and turn with
// the season — none of which is painted into it.
//
// (Roi, after twelve rounds of painting pieces to stand beside hand-painted ones: "i still see huge distinction
// between the quality of FA assets to ours". The answer tried here is not to paint better but to bring the engines to
// the art that is already better. Nothing of anyone's art is held in this module: it works on what it is handed.)
//
// All of it is plain arithmetic on a picture's pixels (RGBA, row by row), so it is tested without a canvas.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// A box blur (pure): each value the mean of those within `r` of it along one axis, then the other. Twice over it is
// near enough a soft blur, and it costs the same however wide.
function blurred(src, w, h, r) {
  r = Math.max(1, Math.round(r));
  const pass = (from, to, n, stride, lines, lineStride) => {
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride; let sum = 0;
      for (let i = -r; i <= r; i++) sum += from[base + Math.min(n - 1, Math.max(0, i)) * stride];
      for (let i = 0; i < n; i++) { to[base + i * stride] = sum / (2 * r + 1); sum += from[base + Math.min(n - 1, i + r + 1) * stride] - from[base + Math.max(0, i - r) * stride]; }
    }
  };
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let k = 0; k < 2; k++) { pass(a, b, w, 1, h, w); pass(b, a, h, w, w, 1); }
  return a;
}

/**
 * How high each part of a picture stands and how much it shines (pure), read from the picture alone.
 *
 * Height is two guesses added. The first is the piece's body: far inside its outline it stands high, toward its edge
 * it falls away — so its rim catches the light on the side the light is. The second is what the painter already
 * said: in a picture seen from above, what is painted pale is nearly always what stands up (a board's face, a
 * stone's top) and what is painted dark is what is down in (a join, a crack, the inside of a bucket).
 *
 * Shine is a guess too: what is grey and neither dark nor pale is likeliest metal; what is strongly coloured is not.
 *
 * Returns { height: Float32Array 0-1, shine: Float32Array 0-1 }, both nothing outside the outline.
 */
export function readRelief(rgba, w, h, { body = 0.55, detail = 0.45 } = {}) {
  const n = w * h, alpha = new Float32Array(n), lum = new Float32Array(n), shine = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4] / 255, g = rgba[i * 4 + 1] / 255, b = rgba[i * 4 + 2] / 255, a = rgba[i * 4 + 3] / 255;
    alpha[i] = a; lum[i] = (r * 0.3 + g * 0.59 + b * 0.11) * a;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0, l = (mx + mn) / 2;
    shine[i] = a * clamp01(1 - sat * 3.2) * clamp01(1 - Math.abs(l - 0.52) * 3) * 0.7;
  }
  const size = Math.max(w, h), dome = blurred(alpha, w, h, size * 0.06), soft = blurred(lum, w, h, Math.max(1, size * 0.006)), height = new Float32Array(n);
  for (let i = 0; i < n; i++) height[i] = alpha[i] < 0.02 ? 0 : clamp01(body * Math.pow(clamp01(dome[i] * 1.15), 1.4) + detail * soft[i]);
  return { height, shine: blurred(shine, w, h, Math.max(1, size * 0.004)) };
}

/** The relief as the lit shader takes it (pure): height in red, shine in green, the picture's own outline in alpha. */
export function reliefPixels(rgba, w, h, opts) {
  const { height, shine } = readRelief(rgba, w, h, opts), out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const a = rgba[i * 4 + 3] / 255; out[i * 4] = height[i] * 255 * a; out[i * 4 + 1] = shine[i] * 255 * a; out[i * 4 + 3] = rgba[i * 4 + 3]; }
  return out;
}

/** A picture's outline filled white (pure): what the engines cast its shadows from, as paintDecor gives them. */
export function silhouettePixels(rgba, w, h, threshold = 0.12) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const on = rgba[i * 4 + 3] / 255 > threshold; out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = on ? 255 : 0; out[i * 4 + 3] = on ? 255 : 0; }
  return out;
}

// A number from a place and a seed, the same every time (pure): for where the snow lies.
const hash = (x, y, seed) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
const smooth = (t) => t * t * (3 - 2 * t);
// Soft noise (pure): the hash at the corners of a grid, eased between them.
const noise = (x, y, seed) => { const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi), a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };

const toHsl = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (d < 1e-6) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1) + 1e-6), hh = (mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; return [(hh + 360) % 360, Math.min(1, s), l]; };
const fromHsl = (hh, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = l - c / 2, [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x]; return [r + m, g + m, b + m]; };

/** How much of a picture is leaf-green (pure, 0-1): what tells a bush from a barrel, so only what grows turns. */
export function greenShare(rgba, w, h) {
  let green = 0, seen = 0;
  for (let i = 0; i < w * h; i++) { if (rgba[i * 4 + 3] < 40) continue; seen++; const [hh, s] = toHsl(rgba[i * 4] / 255, rgba[i * 4 + 1] / 255, rgba[i * 4 + 2] / 255); if (hh > 55 && hh < 170 && s > 0.18) green++; }
  return seen ? green / seen : 0;
}

/**
 * Whether a picture is of something burning (pure): it has a glowing core — pixels near white-hot yellow — which
 * paint of carrots, brass and red cloth does not.
 */
export function burningShare(rgba, w, h) {
  let core = 0, seen = 0;
  for (let i = 0; i < w * h; i++) { if (rgba[i * 4 + 3] < 40) continue; seen++; const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]; if (r > 235 && g > 140 && b < g * 0.75) core++; }
  return seen ? core / seen : 0;
}

/**
 * Where snow lies on a picture (pure): 0-1 for each pixel, its edges crisp as a drift's are.
 * It lies first on what stands highest ('height', from readRelief) and in drifts between; half a fall covers about
 * half the piece, a full one all of it. On a burning piece ('burning', guessed from the picture when left out) none
 * lies on the fire or close round it.
 */
export function snowCover(rgba, w, h, { snow = 0, height = null, seed = 1, burning = null } = {}) {
  const n = w * h, cover = new Float32Array(n), sn = clamp01(snow); if (!sn) return cover;
  const size = Math.max(w, h), scale = 9 / size, edge = sn < 0.25 ? 1 - sn : sn < 0.5 ? 0.75 - (sn - 0.25) * 0.6 : sn < 0.9 ? 0.6 - (sn - 0.5) * 0.4 : 0.44 - (sn - 0.9) * 5; /* (a light fall dusts the tops; half a fall, half the piece; a full one, all of it) */
  let melt = null;
  if (burning ?? burningShare(rgba, w, h) > 0.004) { const hot = new Float32Array(n); for (let i = 0; i < n; i++) { const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]; if (rgba[i * 4 + 3] > 40 && r > 178 && r > g * 1.2 && g > b * 1.3) hot[i] = 1; } melt = blurred(hot, w, h, size * 0.05); }
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] < 4) continue;
    const x = i % w, y = (i / w) | 0, hgt = height ? height[i] : 0.5;
    const drift = noise(x * scale, y * scale, seed) * 0.5 + noise(x * scale * 2.7, y * scale * 2.7, seed + 3) * 0.4 + noise(x * scale * 8, y * scale * 8, seed + 5) * 0.1;
    cover[i] = clamp01((hgt * 0.45 + drift * 0.75 - edge) * 12) * (melt ? 1 - clamp01(melt[i] * 6) : 1);
  }
  return cover;
}

/**
 * A picture under the world's conditions (pure): a new picture, the first untouched.
 *   season  'autumn' turns its greens to ochre and rust, 'winter' to dead straw, 'spring' freshens them; only greens.
 *   wet     0-1: darker and a little bluer all over, as wood and stone and cloth go in rain.
 *   snow    0-1: snow lying on it — first and deepest on what stands highest (`height`, from readRelief), in drifts.
 * `height` may be left out (then snow lies evenly); `seed` moves the drifts; `cover` is snowCover's, when already made.
 */
export function underConditions(rgba, w, h, { season = 'summer', wet = 0, snow = 0, height = null, seed = 1, cover = null, burning = null } = {}) {
  const out = new Uint8ClampedArray(rgba), turn = season === 'autumn' || season === 'winter' || season === 'spring';
  const sn = clamp01(snow), wt = clamp01(wet), scale = 9 / Math.max(w, h), lies = sn > 0 ? cover ?? snowCover(rgba, w, h, { snow: sn, height, seed, burning }) : null;
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3]; if (a < 4) continue;
    let r = rgba[i * 4] / 255, g = rgba[i * 4 + 1] / 255, b = rgba[i * 4 + 2] / 255;
    if (turn) {
      const [hh, s, l] = toHsl(r, g, b);
      if (hh > 55 && hh < 170 && s > 0.18) {
        // (How green it is decides how far it turns, so a brown twig among the leaves stays a brown twig.)
        const k = clamp01((s - 0.18) * 3) * clamp01(1 - Math.abs(hh - 105) / 60 + 0.4), x = i % w, y = (i / w) | 0, vary = noise(x * scale * 3, y * scale * 3, seed + 7);
        const [th, ts, tl] = season === 'autumn' ? [28 + vary * 26, Math.min(1, s * 1.15), l * 1.04] : season === 'winter' ? [42, s * 0.34, l * 0.86] : [hh - 8, Math.min(1, s * 1.12), l * 1.06];
        [r, g, b] = fromHsl(hh + (th - hh) * k, s + (ts - s) * k, clamp01(l + (tl - l) * k));
      }
    }
    if (wt > 0) { const d = 1 - 0.2 * wt; r *= d * 0.98; g *= d; b *= d * 1.03; }
    if (sn > 0) {
      const x = i % w, y = (i / w) | 0, c = lies[i], rim = c * (1 - c) * 4, grain = noise(x * 0.9, y * 0.9, seed + 11) * 0.03 + noise(x * scale * 5, y * scale * 5, seed + 13) * 0.05;
      // What snow has not reached is chilled a little; what it has is snow: white, a touch of blue where it thins
      // at its edge, and never a mirror of what is under it.
      const chill = 0.16 * sn * (1 - c); r += (0.76 - r) * chill; g += (0.82 - g) * chill; b += (0.9 - b) * chill;
      const sr = 0.95 - grain - rim * 0.12, sg = 0.965 - grain - rim * 0.08, sb = 0.985 - grain * 0.5 - rim * 0.05;
      r += (sr - r) * c; g += (sg - g) * c; b += (sb - b) * c;
    }
    out[i * 4] = clamp01(r) * 255; out[i * 4 + 1] = clamp01(g) * 255; out[i * 4 + 2] = clamp01(b) * 255;
  }
  return out;
}

/**
 * Everything the decoration engines need of a picture, from the picture (pure): its colours under the conditions,
 * its relief for the light, its outline for its shadows, and whether it is something that grows.
 * `image` { data (RGBA), width, height }. Returns { art, relief, silhouette } as RGBA pixels, and { growing }.
 */
export function decorationFromArt(image, conditions = {}, opts = {}) {
  const { data, width: w, height: h } = image, n = w * h, read = readRelief(data, w, h, opts), relief = new Uint8ClampedArray(n * 4), size = Math.max(w, h);
  // (Only what grows turns with the year: the greens of a cart's cabbages are not leaves on a branch.)
  const growing = opts.growing ?? greenShare(data, w, h) > 0.3, burning = opts.burning ?? burningShare(data, w, h) > 0.004;
  const sn = clamp01(conditions.snow ?? 0), cover = sn > 0 ? snowCover(data, w, h, { snow: sn, height: read.height, seed: conditions.seed ?? 1, burning }) : null;
  // Under snow the piece's own boards and joins are gone from the relief: a soft mound lies there, and it is matt.
  const mound = cover ? blurred(read.height, w, h, size * 0.03) : null, lift = cover ? blurred(cover, w, h, Math.max(1, size * 0.012)) : null;
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3] / 255, c = cover ? cover[i] : 0, hgt = c ? read.height[i] + (clamp01(mound[i] + lift[i] * 0.12) - read.height[i]) * c : read.height[i];
    relief[i * 4] = hgt * 255 * a; relief[i * 4 + 1] = read.shine[i] * (1 - c) * 255 * a; relief[i * 4 + 3] = data[i * 4 + 3];
  }
  return { art: underConditions(data, w, h, { ...conditions, season: growing ? conditions.season : 'summer', height: read.height, cover }), relief, silhouette: silhouettePixels(data, w, h), growing, burning };
}
