// Which painted decorations break, how each is told apart, and how the prop rules see one (pure, no Foundry globals).
// A decoration is no document, so each breakable one is dressed as a tile-shaped "decoration view" that propsInArea, nextToMiss,
// groundSlams and the rest read unchanged. A break is stored on its region by the decoration's key.

import { decorPlacements, DECOR_MOST } from "../motion/decor-regions.mjs";
import { DECOR_KINDS, hashText } from "../motion/decor-paint.mjs";
import { readNote } from "./prop-break.mjs";
import { validBreakRequest } from "./prop-requests.mjs";

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

/** The socket message a decoration break travels as. */
export const DECOR_BREAK_MESSAGE = "decor-break";

const decorIndex = createDecorIndex();

/**
 * The GM's check of a decoration break (pure). The GM recomputes the region's placements itself, then the prop rules
 * judge the decoration view with no walls and no lights. `region` is { id, levels, settings, areas, broken }; `queued` holds keys
 * broken but not yet stored. Refusals: off, missing, broken, then validBreakRequest's own.
 */
export function validDecorBreakRequest({ key, cause, note } = {}, { region, scene, grid, sender, target, mover, roll, source, levels, area, now, queued = [], index = decorIndex } = {}) {
  const no = (why) => ({ ok: false, why });
  if (scene?.flags?.animater?.breakableProps !== true) return no("off");
  if (region?.settings?.canBreak !== true) return no("off");
  const { keys, views } = index(region, grid), view = views.find((v) => v.decor.key === key);
  if (!view) return no("missing");
  if (liveBroken(readDecorBroken(region.broken), keys).some((e) => e.key === key) || (queued ?? []).includes(key)) return no("broken");
  const out = validBreakRequest({ cause, note }, { tile: view, walls: [], scene, grid, sender, target, mover, roll, lights: [], source, levels, area, now });
  if (!out.ok) return out;
  const { d } = view.decor;
  return { ok: true, entry: { key, kind: d.kind, x: Math.round(d.x), y: Math.round(d.y), note: out.note }, rubble: out.rubble, fall: out.fall };
}

/** The region's stored breaks after a write (pure): the live ones, then each add whose key is not already there. */
export function decorBrokenAfter(entries, adds, keys) {
  const out = liveBroken(entries, keys), seen = new Set(out.map((e) => e.key));
  for (const a of adds ?? []) if (!seen.has(a.key)) { seen.add(a.key); out.push(a); }
  return out;
}

/** The id a region's decoration rubble carries in its propRubble flag. */
export const decorRubbleId = (regionId) => "decor:" + regionId;

const REPAIR = (id) => ({ _id: id, "flags.animater.-=decorBroken": null });
const hasBroken = (r) => Array.isArray(r?.flags?.animater?.decorBroken) && r.flags.animater.decorBroken.length > 0;
/** One update per region that has stored breaks (pure). `regions` is [{ id, flags }]. */
export const decorRepairUpdates = (regions) => (regions ?? []).filter(hasBroken).map((r) => REPAIR(r.id));
/** One region's repair: its own update (or null) and the rubble regions that are its own (pure). */
export function decorRegionRepair(region, regions) {
  const rubble = decorRubbleId(region.id);
  return { update: hasBroken(region) ? REPAIR(region.id) : null, deleteRegions: (regions ?? []).filter((r) => r?.flags?.animater?.propRubble === rubble).map((r) => r.id) };
}

/**
 * Which decoration wrecks to draw, settle or take away (pure). `shown`, `pending` (broken here, not yet stored) and `late`
 * (shown here, then taken back as refused, now stored after all) are Map<id, seed>; `wanted` is [{ id, note, view }].
 * A wreck already drawn with its seed stays; a pending one is settled; a late one is drawn at rest; any other plays (`animate`).
 * A drawn one no longer wanted, and not pending, goes (its decoration was repaired, moved by an edit, or its region went).
 */
export function decorWreckChanges({ shown, wanted, pending, late, animate } = {}) {
  const show = [], settle = [], want = new Set(), has = (map, id, seed) => !!map?.has(id) && map.get(id) === seed;
  for (const { id, note, view } of wanted ?? []) {
    want.add(id);
    const seed = note?.seed;
    if (has(shown, id, seed)) continue;
    if (has(pending, id, seed)) { settle.push(id); continue; }
    show.push({ id, note, view, animate: has(late, id, seed) ? false : !!animate });
  }
  const hide = [...(shown?.keys() ?? [])].filter((id) => !want.has(id) && !pending?.has(id));
  return { show, hide, settle };
}

/**
 * The GM's coalesced writes of decoration breaks, one region at a time (pure; the tick and the write are handed in).
 * add(id, entry, target) queues an entry; on the next tick one write(target, entries) carries every entry queued for
 * that region, to the target last handed in. A region's next write waits for the one in flight, so each reads the
 * stored breaks the last one left. keys(id) are the queued and in-flight keys, kept until their write resolves.
 * add resolves true once its write landed, false when the write threw (traced) or returned false.
 */
export function createDecorQueue({ write, later = (fn) => setTimeout(fn, 0), trace = () => {} } = {}) {
  const regions = new Map(); // id -> { target, queued: [{ entry, done }], flying: [...], busy, timed }
  const of = (id) => { let r = regions.get(id); if (!r) { r = { target: null, queued: [], flying: [], busy: false, timed: false }; regions.set(id, r); } return r; };
  const plan = (id, r) => { if (r.timed || r.busy || !r.queued.length) return; r.timed = true; later(() => { r.timed = false; void flush(id, r); }); };
  async function flush(id, r) {
    if (r.busy || !r.queued.length) return;
    r.busy = true; r.flying = r.queued; r.queued = [];
    let ok = false;
    try { ok = (await write(r.target, r.flying.map((q) => q.entry))) !== false; }
    catch (e) { trace(`decor write: ${e?.message ?? e}`); }
    const done = r.flying;
    r.flying = []; r.busy = false;
    if (r.queued.length) plan(id, r); else if (regions.get(id) === r) regions.delete(id);
    for (const q of done) q.done(ok);
  }
  return {
    add(id, entry, target) { const r = of(id); r.target = target; return new Promise((done) => { r.queued.push({ entry, done }); plan(id, r); }); },
    keys(id) { const r = regions.get(id); return r ? [...r.flying, ...r.queued].map((q) => q.entry.key) : []; },
  };
}
