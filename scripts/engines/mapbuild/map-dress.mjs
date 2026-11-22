// A built map dressed in the GM's own pictures (pure).
//
// Build a map lays out a village or an inn in our own painted materials. A GM who has picked pictures of their own
// for walls, roofs, doors, windows and ground (own-art.mjs: the "Yours" rows of the Map painting bar) can have the
// builder deal those out over what it builds — and how it deals them is theirs to say: how much of the map, which
// pictures may be used, whether the whole map is alike or each building has its own, whether a picture only goes
// where our own kind would have been the same, and whether a building may be half theirs and half ours.
//
// (Roi, asked whether Build a map should use them: "yes but with randomization oiptions selected by the gm".)
//
// It works on the plan, before any document is made, and by the plan's own seed: the same seed and the same choices
// deal the same pictures to the same buildings on every computer.

import { PATH_KINDS } from './path-lay.mjs';
import { roofFor } from '../motion/roof-paint.mjs';
import { windowFor } from '../motion/window-paint.mjs';

/** What can be dressed, and how the pictures can be dealt. */
export const DRESS_SLOTS = Object.freeze(['wall', 'roof', 'door', 'window', 'ground']);
export const DRESS_DEALS = Object.freeze([['map', 'Whole map alike'], ['building', 'Each building its own'], ['piece', 'Every piece']]);

const clamp01 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; };
// Mulberry32: small, and the same everywhere.
const rngOf = (seed) => { let a = (Number(seed) >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/**
 * The GM's choices, cleaned (pure). `raw` { much 0-1 (how many of the buildings), deal ('map', 'building' or 'piece'),
 * suit (a picture only where our own kind would have been the same), whole (a building all in their pictures or
 * none), pools { wall, roof, door, window, ground: [{ url, as }] } (the pictures that may be used), ours { slot: false }
 * (our own painted ones left out of that slot's mix; in it unless said otherwise) }.
 */
export function dressChoices(raw = {}) {
  const pools = {}, ours = {};
  for (const slot of DRESS_SLOTS) {
    const seen = new Set();
    pools[slot] = (Array.isArray(raw.pools?.[slot]) ? raw.pools[slot] : []).filter((p) => typeof p?.url === 'string' && p.url && !seen.has(p.url) && seen.add(p.url)).map((p) => ({ url: p.url.slice(0, 400), as: String(p.as ?? '') }));
    ours[slot] = raw.ours?.[slot] !== false;
  }
  return { much: clamp01(raw.much ?? 0), deal: DRESS_DEALS.some(([id]) => id === raw.deal) ? raw.deal : 'building', suit: raw.suit !== false, whole: raw.whole !== false, pools, ours };
}

/** Whether there is anything to deal at all (pure). */
export const dressOn = (dress) => !!dress && dress.much > 0 && DRESS_SLOTS.some((slot) => dress.pools?.[slot]?.length > 0);

/**
 * A plan with the GM's pictures dealt over it (pure): { plan, dressed (buildings given any picture), buildings }.
 * The plan is a new one; the one handed in is left as it was. A building takes a strip for its walls, roofing for its
 * roof (never a round tower's cone, which roofing cut into wedges does not suit), a leaf for its doors and a picture
 * for its windows; ground takes a ground picture where it is laid as the same floor (always: cobbles are never dealt
 * onto a meadow, whatever `suit` says).
 */
export function dressPlan(plan = {}, raw = {}, seed = plan.seed ?? 1) {
  const dress = dressChoices(raw), buildings = plan.buildings ?? [];
  if (!dressOn(dress)) return { plan, dressed: 0, buildings: buildings.length };
  const rnd = rngOf((Number(seed) >>> 0) * 40503 + 977), alike = new Map();
  // One of a slot's pictures for a thing of our kind `kind`: any that suits, our own among them where it may be; null
  // is ours. `once`: the same answer for that kind all over the map.
  const deal = (slot, kind, once) => {
    const fits = dress.pools[slot].filter((p) => !dress.suit || !p.as || !kind || p.as === kind);
    const from = [...fits.map((p) => p.url), ...(dress.ours[slot] && fits.length ? [null] : [])];
    if (!fits.length) return null;
    if (once) { const key = `${slot}|${kind}`; if (!alike.has(key)) alike.set(key, from[Math.floor(rnd() * from.length)]); return alike.get(key); }
    return from[Math.floor(rnd() * from.length)];
  };
  const whole = dress.deal === 'map', each = dress.deal === 'piece';
  let dressed = 0;
  const built = buildings.map((b) => {
    // (Every building draws, dressed or not, so that turning "how much" up or down does not reshuffle the rest.)
    const chosen = rnd() < dress.much, material = b.material ?? 'timber', roofed = b.roof !== false && !b.round;
    const wall = deal('wall', material, whole), roof = roofed ? deal('roof', b.roof?.kind ?? roofFor(material), whole) : null;
    const door = deal('door', '', whole), win = deal('window', windowFor(material), whole);
    const doors = (b.doors ?? []).map((d) => ({ d, pic: each ? deal('door', '', false) : door }));
    const windows = (b.windows ?? []).map((w) => ({ w, pic: each ? deal('window', w.kind ?? windowFor(material), false) : win }));
    if (!chosen) return b;
    // All theirs or none: its walls and (where it has one to cover) its roof both, or it is left as it was.
    if (dress.whole && (!wall || (roofed && !roof))) return b;
    if (!wall && !roof && !doors.some((x) => x.pic) && !windows.some((x) => x.pic)) return b;
    dressed++;
    return { ...b, ...(wall ? { cover: wall } : {}),
      ...(b.doors ? { doors: doors.map(({ d, pic }) => (pic ? { ...d, cover: pic } : d)) } : {}),
      ...(b.windows ? { windows: windows.map(({ w, pic }) => (pic ? { ...w, cover: pic } : w)) } : {}),
      ...(roof ? { roof: { ...(b.roof ?? {}), cover: roof } } : {}) };
  });
  // Ground: a picture where it is laid as that floor, one for each kind of floor all over the map unless every piece
  // is dealt on its own.
  const grounds = dress.pools.ground.map((p) => ({ url: p.url, floor: PATH_KINDS[p.as]?.floor ?? '' })).filter((p) => p.floor);
  const groundFor = (floor) => {
    const fits = grounds.filter((p) => p.floor === floor); if (!fits.length || floor === 'water') return null;
    const from = [...fits.map((p) => p.url), ...(dress.ours.ground ? [null] : [])];
    if (each) return from[Math.floor(rnd() * from.length)];
    const key = `ground|${floor}`; if (!alike.has(key)) alike.set(key, from[Math.floor(rnd() * from.length)]); return alike.get(key);
  };
  const laid = (p) => { const image = p?.floor ? groundFor(p.floor) : null; return image ? { ...p, image } : p; };
  return { plan: { ...plan, buildings: built, ...(plan.ground ? { ground: laid(plan.ground) } : {}), ...(plan.patches ? { patches: plan.patches.map(laid) } : {}), ...(plan.paths ? { paths: plan.paths.map(laid) } : {}) }, dressed, buildings: buildings.length };
}
