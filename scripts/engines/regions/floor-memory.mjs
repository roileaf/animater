// Floor memory: the floor generator learns from the regions the GM saves. Each saved area leaves an example (how its
// part of the map looks, and the floor and look the GM gave it); a new area that looks like earlier ones starts with
// their choices. Pure: the examples are a plain array the caller keeps (a world setting), and nothing here touches
// Foundry.
//
// How an area looks is a short signature: its average colour and how much the colour varies (in CIELAB, so a
// distance means roughly what an eye sees), and its grain (how much neighbouring pixels differ: planks and cobbles
// are busy, still water and snow are smooth). Signatures compare across maps by the same painter style; a match must
// be close, so an unlike map falls back to the GM's own pick.

export const MEMORY_TUNING = Object.freeze({
  limit: 400, // examples kept; the oldest go first
  samples: 4000, // pixels read per area at most
  maxDistance: 12, // past this an example is not alike enough to count
  margin: 1.4, // the nearest example of another floor must be this much farther, or the guess is too close to call
});
// Measured on 44 GM-drawn regions from 16 adventure maps (tools/fx-gallery/floor-bench), each guessed from the other
// maps only: 32 right, 3 wrong, 9 left to the GM. Looser settings guessed more and got 5-7 wrong.

// The look a new area takes from an example. Map-specific choices (a river's flow, the sea's waves) are not learned.
export const LEARNED_LOOK = Object.freeze(["waterKind", "texture", "pattern", "edge", "overWater"]);

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const LIN = Float32Array.from({ length: 256 }, (_, i) => lin(i));
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
// sRGB to CIELAB (D65).
export function toLab(r, g, b) {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// An area's signature: [L, a, b, spread of L, spread of a, spread of b, grain], or null for no pixels.
// `pixels`: the area's pixel indices on the map read (width × height, RGBA).
export function areaSignature(rgba, width, height, pixels, { samples = MEMORY_TUNING.samples } = {}) {
  const count = pixels?.length ?? 0;
  if (!count) return null;
  const step = Math.max(1, Math.floor(count / samples));
  const sum = [0, 0, 0], sq = [0, 0, 0];
  let n = 0, grain = 0, grainN = 0;
  for (let i = 0; i < count; i += step) {
    const p = pixels[i], o = p * 4;
    const lab = toLab(rgba[o], rgba[o + 1], rgba[o + 2]);
    for (let k = 0; k < 3; k++) { sum[k] += lab[k]; sq[k] += lab[k] * lab[k]; }
    n++;
    // Grain: the lightness step to the right-hand and lower neighbours (when they are on the map).
    if (p % width < width - 1) { grain += Math.abs(lab[0] - toLab(rgba[o + 4], rgba[o + 5], rgba[o + 6])[0]); grainN++; }
    if (p + width < width * height) { const q = o + width * 4; grain += Math.abs(lab[0] - toLab(rgba[q], rgba[q + 1], rgba[q + 2])[0]); grainN++; }
  }
  const mean = sum.map((s) => s / n);
  const spread = sq.map((s, k) => Math.sqrt(Math.max(0, s / n - mean[k] * mean[k])));
  return [...mean, ...spread, grainN ? grain / grainN : 0].map((v) => Math.round(v * 10) / 10);
}

// How unlike two signatures are. The colour counts most; spread and grain tell apart floors of one colour.
const WEIGHTS = [1, 1.2, 1.2, 0.6, 0.6, 0.6, 0.8];
export function signatureDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += WEIGHTS[i] * (a[i] - b[i]) ** 2;
  return Math.sqrt(d);
}

// The examples kept, cleaned: only well-formed ones, newest last.
export function memoryOf(stored) {
  return (Array.isArray(stored) ? stored : []).filter((e) => e && typeof e.floor === "string" && Array.isArray(e.sig) && e.sig.length === WEIGHTS.length);
}

// The look worth keeping from an area's choices.
export function lookOf(choices = {}) {
  const look = {};
  for (const key of LEARNED_LOOK) if (choices[key] !== undefined && choices[key] !== "" && choices[key] !== false) look[key] = choices[key];
  if (choices.floor !== "water") delete look.waterKind;
  return look;
}

// The memory with these examples added: `entries` are { key, sig, floor, look }. An example with a key already kept
// (one region, saved again) replaces it. The newest `limit` stay.
export function rememberAreas(stored, entries, { limit = MEMORY_TUNING.limit, now = Date.now() } = {}) {
  // A cave's wire floor is "". Memory keeps the picker id, or the truthy check would drop the example.
  const fresh = (entries ?? []).map((e) => (e && e.floor === "" ? { ...e, floor: "cavern" } : e)).filter((e) => e?.key && e.sig && e.floor).map((e) => ({ key: String(e.key), sig: e.sig, floor: e.floor, look: lookOf({ ...e.look, floor: e.floor }), at: now }));
  const keys = new Set(fresh.map((e) => e.key));
  return [...memoryOf(stored).filter((e) => !keys.has(e.key)), ...fresh].slice(-limit);
}

// What earlier areas say about one with signature `sig`: { floor, look, distance } from the most alike example, or null
// when nothing kept is alike enough, or an example of another floor is nearly as alike (too close to call).
// `floor`: only examples of that floor count (the GM picked the floor; only its look is learned).
export function recallFloor(stored, sig, { floor = null, maxDistance = MEMORY_TUNING.maxDistance, margin = MEMORY_TUNING.margin } = {}) {
  if (!sig) return null;
  const near = memoryOf(stored).filter((e) => !floor || e.floor === floor)
    .map((e) => ({ e, d: signatureDistance(sig, e.sig) })).sort((a, b) => a.d - b.d);
  const best = near[0];
  if (!best || best.d > maxDistance) return null;
  const rival = near.find(({ e }) => e.floor !== best.e.floor);
  if (rival && rival.d < best.d * margin) return null;
  return { floor: best.e.floor, look: { ...best.e.look }, distance: Math.round(best.d * 10) / 10 };
}

// "Not a region": an example of something the GM did not want marked (an area marked automatically and then unticked
// or removed). recallFloor answers it like a floor; whoever asks treats it as "leave this alone".
export const NONE_FLOOR = "none";
export const knowsFloors = (stored) => memoryOf(stored).some((e) => e.floor !== NONE_FLOOR);

export const MARK_TUNING = Object.freeze({
  grid: 8, // seeds across the map's long edge
  minShare: 0.003, // smaller pieces are not worth a region
  maxShare: 0.6, // a piece this big is the whole map, not a floor
});

// Seed points spread evenly over the map: `grid` across its long edge, cell centres.
export function gridSeeds(width, height, grid = MARK_TUNING.grid) {
  const step = Math.max(width, height) / grid, out = [];
  for (let y = step / 2; y < height; y += step) for (let x = step / 2; x < width; x += step) out.push({ x: Math.floor(x), y: Math.floor(y) });
  return out;
}

// Marks areas by themselves: at each seed not inside an area yet, `segment(at, claimed)` cuts the piece of map there
// (a promise or a value: { pixels, ... } or null), and the piece is kept when the memory knows its floor.
// `signatureOf(pixels)` reads a piece's signature. `claimed`: areas already there, never overlapped.
// `progress(done, total)`: told after each seed. Returns the kept pieces with { floor, look, sig, learned, auto }.
export async function markAreas({ width, height, seeds = gridSeeds(width, height), segment, signatureOf, memory, claimed = [], progress = null, minShare = MARK_TUNING.minShare, maxShare = MARK_TUNING.maxShare, stop = () => false }) {
  const covered = new Uint8Array(width * height), owned = new Uint8Array(width * height); // looked at; inside an area
  for (const area of claimed) for (const p of area.pixels ?? []) { covered[p] = 1; owned[p] = 1; }
  const kept = [];
  for (let i = 0; i < seeds.length; i++) {
    if (stop()) break;
    const at = seeds[i];
    if (!covered[Math.floor(at.y) * width + Math.floor(at.x)]) {
      const piece = await segment(at, [...claimed, ...kept]);
      const pixels = piece?.pixels ?? [];
      for (const p of pixels) covered[p] = 1; // looked at: no other seed in it cuts it again
      const share = pixels.length / (width * height);
      if (pixels.length && share >= minShare && share <= maxShare && !pixels.some((p) => owned[p])) {
        const sig = signatureOf(pixels), got = recallFloor(memory, sig);
        if (got && got.floor !== NONE_FLOOR) { kept.push({ ...piece, floor: got.floor, look: got.look, sig, learned: true, auto: true }); for (const p of pixels) owned[p] = 1; }
      }
    }
    progress?.(i + 1, seeds.length);
  }
  return kept;
}
