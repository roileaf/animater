// Which painted decorations break, how each is told apart, and how the prop rules see one (pure, no Foundry globals).
// A decoration is no document, so each breakable one is dressed as a tile-shaped "decoration view" that propsInArea, nextToMiss,
// groundSlams and the rest read unchanged. A break is stored on its region by the decoration's key.

import { CAVERN_KINDS, decorPlacements, DECOR_MOST } from "../motion/decor-regions.mjs";
import { DECOR_KINDS, hashText, paintedMaterial, paintSeedOf } from "../motion/decor-paint.mjs";
import { webCorners } from "../motion/webs.mjs";
import { readNote } from "./prop-break.mjs";
import { validBreakRequest } from "./prop-requests.mjs";

// Each kind that breaks: its material and style as the prop rules read them, and where the rules need more than the kind's
// name: `boxy` (breaks as a box, not round), `contents` (what spills), `tips` (knocked over whole, as a brazier) and
// `rule` (decor-rules.mjs: what breaks it where its material's rules say otherwise). Some (cart, kennel, firewood,
// signpost, candles, beehive, nest) are still drafts the painter does not offer yet; they break as listed once taken in.
const ENTRY = (material, style, extra = {}) => Object.freeze({ material, style, ...extra });
export const DECOR_BREAKS = Object.freeze({
  crate: ENTRY("wood", "shatter"), barrel: ENTRY("wood", "shatter"), crystals: ENTRY("glass", "shatter"),
  bush: ENTRY("plant", "burn"), fern: ENTRY("plant", "burn"), agave: ENTRY("plant", "burn"), reeds: ENTRY("plant", "burn"), cobweb: ENTRY("plant", "burn"),
  stalagmite: ENTRY("stone", "topple"), column: ENTRY("stone", "topple"),
  // The town and dungeon kinds (spec amendment).
  cart: ENTRY("wood", "shatter", { boxy: true }), coffin: ENTRY("wood", "shatter", { boxy: true }), kennel: ENTRY("wood", "shatter", { boxy: true }),
  produce: ENTRY("wood", "shatter", { boxy: true, contents: "goods" }), trough: ENTRY("wood", "shatter", { boxy: true, contents: "water" }),
  washtub: ENTRY("wood", "shatter", { contents: "water" }), firewood: ENTRY("wood", "shatter"),
  fence: ENTRY("wood", "collapse"), bench: ENTRY("wood", "collapse"), signpost: ENTRY("wood", "topple"),
  urns: ENTRY("clay", "shatter", { contents: "grain" }), planter: ENTRY("wood", "shatter", { boxy: true }),
  tombstone: ENTRY("stone", "topple"), sarcophagus: ENTRY("stone", "shatter", { boxy: true, rule: "noSlam" }),
  brazier: ENTRY("metal", "shatter", { tips: true }), cage: ENTRY("wood", "shatter", { boxy: true }),
  haystack: ENTRY("plant", "burn"), tent: ENTRY("plant", "burn"), bedroll: ENTRY("plant", "burn"), beehive: ENTRY("plant", "burn"), nest: ENTRY("plant", "burn"),
  sacks: ENTRY("plant", "burn", { contents: "grain", rule: "torn" }), candles: ENTRY("wood", "shatter", { rule: "any" }),
  // Roi's extra kinds (2026-11-10). A street lamp's light goes out while it lies broken (decorations.lights() leaves it out);
  // its name would read as a lantern's oil to spill, and it spills none.
  lampPost: ENTRY("metal", "topple", { rule: "heavy", contents: "none" }), tableStools: ENTRY("wood", "collapse"), marketStall: ENTRY("wood", "collapse", { boxy: true }),
  stakeFence: ENTRY("wood", "collapse"), strawBed: ENTRY("plant", "burn"),
  // The indoor and water kinds (spec Amendment 2; a rowboat bursts into planks, controller ruling). A throne, a bathtub or a mooring post breaks as what its picture is painted of (`painted`,
  // by decor-paint paintedMaterial): wood shatters or collapses, stone needs force, a copper tub follows metal's rules.
  bookshelf: ENTRY("wood", "collapse", { boxy: true, contents: "books" }), bed: ENTRY("wood", "collapse", { boxy: true }), desk: ENTRY("wood", "collapse", { boxy: true }),
  counter: ENTRY("wood", "collapse", { boxy: true }), rowboat: ENTRY("wood", "shatter", { boxy: true }), strongbox: ENTRY("wood", "shatter", { boxy: true }),
  statue: ENTRY("stone", "topple"), altar: ENTRY("stone", "shatter", { boxy: true, rule: "noSlam" }),
  pottedPlant: ENTRY("clay", "shatter"), rug: ENTRY("plant", "burn"), cattails: ENTRY("plant", "burn"),
  throne: Object.freeze({ painted: Object.freeze({ wood: ENTRY("wood", "collapse", { boxy: true }), stone: ENTRY("stone", "shatter", { boxy: true, rule: "noSlam" }) }) }),
  // A mooring post is a log post or an iron bollard: the iron one, like a street lamp, needs force or a Large slam to topple.
  mooringPost: Object.freeze({ painted: Object.freeze({ wood: ENTRY("wood", "topple"), metal: ENTRY("metal", "topple", { rule: "heavy", contents: "none" }) }) }),
  bathtub: Object.freeze({ painted: Object.freeze({ wood: ENTRY("wood", "shatter", { contents: "water" }), stone: ENTRY("stone", "shatter", { contents: "water", rule: "noSlam" }), metal: ENTRY("metal", "shatter", { contents: "water" }) }) }),
});
/** How one decoration breaks (pure): its kind's entry, or for a throne, a bathtub or a mooring post the entry of what its picture is painted of; null when it never breaks. */
export function decorBreakOf(d) {
  const b = Object.hasOwn(DECOR_BREAKS, d?.kind) ? DECOR_BREAKS[d.kind] : null;
  return b?.painted ? b.painted[paintedMaterial(d.kind, paintSeedOf(d))] ?? null : b;
}
/** What the topple whisper calls a toppled decoration. */
export const DECOR_NAMES = Object.freeze({ stalagmite: "A stalagmite", column: "A rock column", signpost: "A signpost", tombstone: "A gravestone", lampPost: "A street lamp", statue: "A statue", mooringPost: "A mooring post" });

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
  // (A hand one scaled by the region's Size or its kind's size is a copy: told apart by its kind, place and seed.)
  const handOf = (d) => `${d.kind}:${d.x}:${d.y}:${d.seed}`, placed = decorPlacements({ settings, areas, grid, id }), byHand = new Set(settings?.brushed ?? []), handAt = new Set((settings?.brushed ?? []).map(handOf));
  if (!placed.length) return [];
  const fp = decorFingerprint(region, grid);
  return placed.map((d) => { const hand = byHand.has(d) || handAt.has(handOf(d)); return { d, hand, key: `${d.kind}:${px(d.x)}:${px(d.y)}:${hand ? "h" : fp}` }; });
}

/**
 * A decoration dressed as a prop tile (pure); null when its kind does not break. `region` is { id, levels, where }.
 * Its picture's name says what the name rules read (a boxy one is named a box); its flags the material, style, contents
 * and tipping; `decor.rule` what breaks it where its material's rules say otherwise.
 */
export function decorView({ d, key }, region, grid) {
  const b = decorBreakOf(d); if (!b) return null;
  const s = d.size * grid, prop = { material: b.material, style: b.style };
  if (b.contents) prop.contents = b.contents;
  if (b.tips) prop.tips = "yes";
  return {
    id: `decor:${region.id}:${key}`, x: d.x - s / 2, y: d.y - s / 2, width: s, height: s, rotation: 0, hidden: false,
    levels: [...(region.levels ?? [])], texture: { src: `decor/${d.kind}${b.boxy ? "-box" : ""}.webp` },
    flags: { animater: { prop } },
    decor: { regionId: region.id, key, kind: d.kind, d, where: region.where ?? "surface", ...(b.rule ? { rule: b.rule } : {}) },
  };
}

// The round area a decoration underground hands the cavern or the webs (as decorations.cavern() draws it), as a polygon.
const ringOf = (d, grid, what) => { const r = d.size * grid * (what === "webs" ? 1.2 : 0.5); return Array.from({ length: 12 }, (_, i) => [d.x + Math.cos((i / 12) * 6.283) * r, d.y + Math.sin((i / 12) * 6.283) * r]); };
const insideRing = (p, ring) => { let on = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) on = !on; } return on; };
/**
 * Whether a decoration is drawn on the map (pure). Above ground everything is painted. Underground, crystals and cobwebs
 * go to the cavern and the webs: crystals show only while the cavern draws crystals (`crystals`), and a cobweb only where
 * the web engine drew a web inside its ring (`webs`: the corners it built, webs.mjs webCorners). Unknown (undefined) is left
 * to the rules: a GM checking a scene it is not viewing has no corners.
 */
export function decorDrawn(view, { crystals, webs, grid = 100 } = {}) {
  const what = view?.decor?.where === "cave" ? CAVERN_KINDS[view.decor.kind] : null;
  if (what === "crystals") return crystals !== false;
  if (what !== "webs" || !Array.isArray(webs)) return true;
  const ring = ringOf(view.decor.d, grid, "webs");
  return webs.some((c) => insideRing({ x: c.x + (c.u[0] + c.v[0]) * grid * 0.25, y: c.y + (c.u[1] + c.v[1]) * grid * 0.25 }, ring));
}

// A flat polygon [x0, y0, x1, y1, ...] holds a point (ray cast).
const insideFlat = ({ x, y }, p) => { let on = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) on = !on; return on; };
/**
 * Underground floor, not the rock between the rooms: inside some light's shape (flat polygons, one per light; null for a
 * light with none). No lights at all: floor everywhere. Built from the scene's own lights, so it is the same on every screen.
 */
export const lightFloor = (shapes = []) => (pt) => !shapes.length || shapes.some((s) => Array.isArray(s) && s.length >= 6 && insideFlat(pt, s));
// A cobweb's area as the cavern feed hands it to the webs (decorations.mjs cavern(): a 12-point ring, flat).
const webRing = (d, grid) => { const r = d.size * grid * 1.2; return Array.from({ length: 12 }, (_, i) => [d.x + Math.cos((i / 12) * 6.283) * r, d.y + Math.sin((i / 12) * 6.283) * r]).flat(); };
/**
 * What of the decorations underground can break (pure), for decorDrawn: { crystals, webs }. Worked out from what every
 * screen shares, as if drawn at full quality with every underground feature on: the world's Cave crystals and Cave webs
 * switches (`setting(key)` reads only those two), the webs regions' areas (`webAreas`), every cobweb of the cave decoration
 * regions (`decorRegions`, broken or not, so a break never moves another web), the walls, and the floor the scene's
 * lights reach (`lights`, lightFloor). Never a screen's Quality, its own switches or its sparks and dust: a screen that
 * draws less only has nothing to hide where it draws nothing.
 */
export function decorCaveBreakable({ setting = () => undefined, webAreas = [], decorRegions = [], walls = [], lights = [], grid = 100, seed = "cave", index = decorIndex } = {}) {
  const world = (key) => { try { return setting(key) !== false; } catch { return true; } };
  const crystals = world("caveCrystals");
  if (!world("caveWebs")) return { crystals, webs: [] };
  const areas = [...webAreas];
  for (const r of decorRegions) {
    if ((r?.settings?.where ?? "surface") !== "cave") continue;
    for (const { d } of index(r, grid).keyed) if (CAVERN_KINDS[d.kind] === "webs") areas.push(webRing(d, grid));
  }
  return { crystals, webs: areas.length ? webCorners({ walls, areas, grid, seed, floor: lightFloor(lights) }) : [] };
}

/**
 * Many decoration breaks at once repaint once (pure; the frame is handed in). soon(regionId, { cave }) asks for the painter
 * (and, for a region underground, the cavern) to be rebuilt; on the next frame one redraw({ regions, cave }) rebuilds
 * every region asked for, the cavern once if any was underground. A redraw that throws never stops the next one.
 */
export function createDecorRedraw({ redraw, later = (fn) => setTimeout(fn, 16) } = {}) {
  let regions = new Set(), cave = false, timed = false;
  return {
    soon(id, { cave: under = false } = {}) {
      regions.add(id); if (under) cave = true;
      if (timed) return;
      timed = true;
      later(() => { const what = { regions, cave }; regions = new Set(); cave = false; timed = false; redraw(what); });
    },
    get waiting() { return timed; },
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
/**
 * A region dragged (decor-regions carryDecor moved what was painted by hand by dx, dy): the breaks of those hand decorations move
 * with them (pure), keyed where they now stand. A toppled one that left rubble is not carried: the edit stands it up again and
 * its rubble goes with its stale entry (decorToppledPrune). Scattered ones are left as they are (the drag moved their scatter).
 */
export function carryDecorBroken(entries, dx, dy) {
  return (entries ?? []).map((e) => {
    if (!e?.key?.endsWith(":h") || e.note?.region || !Number.isFinite(e.x) || !Number.isFinite(e.y)) return e;
    const x = e.x + dx, y = e.y + dy;
    return { ...e, x, y, key: `${e.kind}:${px(x)}:${px(y)}:h` };
  });
}
/** The breaks whose decoration still stands (pure); the others are stale and ignored. */
export const liveBroken = (entries, keys) => entries.filter((e) => keys.has(e.key));

/** A memo of each region's keyed placements and views, rebuilt only when what moves them changes (canBreak never does). */
export function createDecorIndex() {
  const memo = new Map();
  const index = (region, grid) => {
    const { canBreak: _off, ...moves } = region.settings ?? {};
    const sig = JSON.stringify([moves, areasOf(region.areas), grid, region.levels]);
    const hit = memo.get(region.id); if (hit?.sig === sig) return hit.value;
    const keyed = decorKeyed(region, grid), at = { id: region.id, levels: region.levels, where: region.settings?.where ?? "surface" };
    const value = { keyed, keys: new Set(keyed.map((k) => k.key)), views: keyed.map((k) => decorView(k, at, grid)).filter(Boolean) };
    memo.set(region.id, { sig, value });
    return value;
  };
  // A region deleted, or the canvas torn down: what it remembered goes.
  index.forget = (id) => memo.delete(id);
  index.clear = () => memo.clear();
  return index;
}

/**
 * The decoration views a cause can reach (pure): switched-on regions' breakable decorations, less the ones already broken
 * and, given `drawn` (decorDrawn), those not drawn on the map.
 */
export function decorTargets(regions, grid, index, drawn = null) {
  const out = [];
  for (const r of regions) {
    if (r.settings?.canBreak !== true) continue;
    const { keys, views } = index(r, grid), gone = new Set(liveBroken(readDecorBroken(r.broken), keys).map((e) => e.key));
    for (const v of views) if (!gone.has(v.decor.key) && (!drawn || drawn(v))) out.push(v);
  }
  return out;
}

/** The socket message a decoration break travels as. */
export const DECOR_BREAK_MESSAGE = "decor-break";

const decorIndex = createDecorIndex();

/**
 * The GM's check of a decoration break (pure). The GM recomputes the region's placements itself, then the prop rules
 * judge the decoration view with no walls and no lights. `region` is { id, levels, settings, areas, broken }; `queued` holds keys
 * broken but not yet stored; `drawn` (decorDrawn) refuses one not drawn on the map. Refusals: off, missing, undrawn,
 * broken, then validBreakRequest's own.
 */
export function validDecorBreakRequest({ key, cause, note } = {}, { region, scene, grid, sender, target, mover, roll, source, levels, area, now, queued = [], index = decorIndex, drawn = null } = {}) {
  const no = (why) => ({ ok: false, why });
  if (scene?.flags?.animater?.breakableProps !== true) return no("off");
  if (region?.settings?.canBreak !== true) return no("off");
  const { keys, views } = index(region, grid), view = views.find((v) => v.decor.key === key);
  if (!view) return no("missing");
  if (drawn && !drawn(view)) return no("undrawn");
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
 * add resolves true once its write landed, false when the write threw (traced) or returned false. idle(id) resolves once
 * that region (no id: every region) has nothing queued or in flight, so Repair reads what the writes left.
 */
export function createDecorQueue({ write, later = (fn) => setTimeout(fn, 0), trace = () => {} } = {}) {
  const regions = new Map(); // id -> { target, queued: [{ entry, done }], flying: [...], busy, timed }
  let waiters = []; // [{ id, done }]: idle() calls waiting
  const busy = (id) => (id == null ? regions.size > 0 : regions.has(id));
  const wake = () => { const still = []; for (const w of waiters) if (busy(w.id)) still.push(w); else w.done(); waiters = still; };
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
    wake();
  }
  return {
    add(id, entry, target) { const r = of(id); r.target = target; return new Promise((done) => { r.queued.push({ entry, done }); plan(id, r); }); },
    keys(id) { const r = regions.get(id); return r ? [...r.flying, ...r.queued].map((q) => q.entry.key) : []; },
    idle(id) { return busy(id) ? new Promise((done) => waiters.push({ id, done })) : Promise.resolve(); },
  };
}

/**
 * The rubble a region write leaves behind (pure): the rubble regions named by the entries it drops as stale (stored ones
 * whose decoration an edit moved, and adds checked before such an edit), when they are this region's own decoration
 * rubble. `regions` is [{ id, flags }].
 */
export function decorPrunedRubble(entries, keys, regions, regionId) {
  const own = new Set((regions ?? []).filter((r) => r?.flags?.animater?.propRubble === decorRubbleId(regionId)).map((r) => r.id));
  const out = new Set();
  for (const e of entries ?? []) { const id = e?.note?.region; if (!keys.has(e?.key) && own.has(id)) out.add(id); }
  return [...out];
}

// A flat polygon [x0, y0, x1, y1, ...] as points, for insideRing.
const pairs = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]); return out; };
/**
 * The webs to draw (pure): `corners` as webCorners laid them out over every web area, broken cobwebs' included, less those
 * whose middle lies only in a broken cobweb's area (`gone`), not in any standing one's or a webs region's (`keep`). The
 * others stay exactly as laid out, so breaking one web never moves, adds or lengthens another, on any screen.
 */
export function keptWebCorners(corners, { keep = [], gone = [], grid = 100 } = {}) {
  if (!gone.length) return [...(corners ?? [])];
  const goneRings = gone.map(pairs), keepRings = keep.map(pairs);
  return (corners ?? []).filter((c) => {
    const mid = { x: c.x + (c.u[0] + c.v[0]) * grid * 0.25, y: c.y + (c.u[1] + c.v[1]) * grid * 0.25 };
    return !goneRings.some((r) => insideRing(mid, r)) || keepRings.some((r) => insideRing(mid, r));
  });
}

/**
 * After an edit (GM): a region's stale toppled entries and their rubble (pure). An edit that moved a toppled decoration
 * stands it up whole again, so the rubble it left goes with its entry; other stale breaks stay, so undoing the edit
 * brings them back (ruling D8). { keep (the entries to store), deleteRegions } or null when nothing is to go.
 */
export function decorToppledPrune(entries, keys, regions, regionId) {
  const deleteRegions = decorPrunedRubble(entries, keys, regions, regionId);
  if (!deleteRegions.length) return null;
  const gone = new Set(deleteRegions);
  return { keep: (entries ?? []).filter((e) => keys.has(e?.key) || !gone.has(e?.note?.region)), deleteRegions };
}

const QUIET_FLAGS = new Set(["decorBroken", "-=decorBroken"]);
/**
 * A region update that only stores or clears decoration breaks (pure): written with options.animater.decorBreak or
 * decorRepair, changing nothing but flags.animater.decorBroken. Only the decoration painter and wrecks need it; the
 * region rebuilds (floors, canopy, sky, air, life...) skip it. Any other change in the same update is a real edit.
 */
export function decorOnlySave(changes, options) {
  const a = options?.animater;
  if (a?.decorBreak !== true && a?.decorRepair !== true) return false;
  const keys = Object.keys(changes ?? {}).filter((k) => k !== "_id" && k !== "_stats");
  if (!keys.length) return false;
  const nested = keys.length === 1 && keys[0] === "flags" ? changes.flags : null;
  if (nested) {
    const scopes = Object.keys(nested ?? {});
    if (scopes.length !== 1 || scopes[0] !== "animater") return false;
    const own = Object.keys(nested.animater ?? {});
    return own.length > 0 && own.every((k) => QUIET_FLAGS.has(k));
  }
  return keys.every((k) => k.startsWith("flags.animater.") && QUIET_FLAGS.has(k.slice("flags.animater.".length)));
}
