// Which painted decorations break, how each is told apart, and how the prop rules see one (pure, no Foundry globals).
// A decoration is no document, so each breakable one is dressed as a tile-shaped "decoration view" that propsInArea, nextToMiss,
// groundSlams and the rest read unchanged. A break is stored on its region by the decoration's key.

import { decorPlacements, DECOR_MOST } from "../motion/decor-regions.mjs";
import { DECOR_KINDS, hashText } from "../motion/decor-paint.mjs";
import { readNote } from "./prop-break.mjs";

const ENTRY = (material, style) => Object.freeze({ material, style });
export const DECOR_BREAKS = Object.freeze({
  crate: ENTRY("wood", "shatter"), barrel: ENTRY("wood", "shatter"), crystals: ENTRY("glass", "shatter"),
  bush: ENTRY("plant", "burn"), fern: ENTRY("plant", "burn"), agave: ENTRY("plant", "burn"), reeds: ENTRY("plant", "burn"), cobweb: ENTRY("plant", "burn"),
  stalagmite: ENTRY("stone", "topple"), column: ENTRY("stone", "topple"),
});
/** What the topple whisper calls a toppled decoration. */
export const DECOR_NAMES = Object.freeze({ stalagmite: "A stalagmite", column: "A rock column" });

const px = (n) => Math.round(n);
// An area's holes are an array property, which JSON.stringify of the areas array drops: write them out.
const areasOf = (areas) => (areas ?? []).map((a) => [Array.from(a, px), (a.holes ?? []).map((h) => Array.from(h, px))]);

/** A short text that changes whenever the region's scatter moves (pure). Settings that never move it (canBreak, brushed) stay out. */
export function decorFingerprint(region, grid) {
  const s = region.settings ?? {};
  const kinds = Object.entries(s.kinds ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, k]) => [id, k.size, k.amount]);
  return hashText(JSON.stringify([region.id, grid, s.where, kinds, s.density, s.scale, s.seed, s.erased ?? [], areasOf(region.areas)])).toString(36);
}

/** Every placement of a region with its key, breakable or not; `hand` marks one put down by hand (pure). */
export function decorKeyed(region, grid) {
  const { settings, areas, id } = region;
  const placed = decorPlacements({ settings, areas, grid, id }), byHand = new Set(settings?.brushed ?? []);
  if (!placed.length) return [];
  const fp = decorFingerprint(region, grid);
  return placed.map((d) => { const hand = byHand.has(d); return { d, hand, key: `${d.kind}:${px(d.x)}:${px(d.y)}:${hand ? "h" : fp}` }; });
}

/** A decoration dressed as a prop tile (pure); null when its kind does not break. `region` is { id, levels }. */
export function decorView({ d, key }, region, grid) {
  const b = DECOR_BREAKS[d.kind]; if (!b) return null;
  const s = d.size * grid;
  return {
    id: `decor:${region.id}:${key}`, x: d.x - s / 2, y: d.y - s / 2, width: s, height: s, rotation: 0, hidden: false,
    levels: [...(region.levels ?? [])], texture: { src: `decor/${d.kind}.webp` },
    flags: { animater: { prop: { material: b.material, style: b.style } } },
    decor: { regionId: region.id, key, kind: d.kind, d },
  };
}

/** The stored breaks that are well formed (pure): a key, a breakable kind, a place and a note the rules accept. */
export function readDecorBroken(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    if (out.length >= DECOR_MOST) break;
    if (!e || typeof e.key !== "string" || e.key.length < 1 || e.key.length > 160 || !Object.hasOwn(DECOR_BREAKS, e.kind)) continue;
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
    const note = readNote(e.note); if (!note) continue;
    out.push({ key: e.key, kind: e.kind, x: e.x, y: e.y, note });
  }
  return out;
}
/** The breaks whose decoration still stands (pure); the others are stale and ignored. */
export const liveBroken = (entries, keys) => entries.filter((e) => keys.has(e.key));

/** A memo of each region's keyed placements and views, rebuilt only when what moves them changes (canBreak never does). */
export function createDecorIndex() {
  const memo = new Map();
  return (region, grid) => {
    const { canBreak: _off, ...moves } = region.settings ?? {};
    const sig = JSON.stringify([moves, areasOf(region.areas), grid, region.levels]);
    const hit = memo.get(region.id); if (hit?.sig === sig) return hit.value;
    const keyed = decorKeyed(region, grid), at = { id: region.id, levels: region.levels };
    const value = { keyed, keys: new Set(keyed.map((k) => k.key)), views: keyed.map((k) => decorView(k, at, grid)).filter(Boolean) };
    memo.set(region.id, { sig, value });
    return value;
  };
}

/** The decoration views a cause can reach (pure): switched-on regions' breakable decorations, less the ones already broken. */
export function decorTargets(regions, grid, index) {
  const out = [];
  for (const r of regions) {
    if (r.settings?.canBreak !== true) continue;
    const { keys, views } = index(r, grid), gone = new Set(liveBroken(readDecorBroken(r.broken), keys).map((e) => e.key));
    for (const v of views) if (!gone.has(v.decor.key)) out.push(v);
  }
  return out;
}
