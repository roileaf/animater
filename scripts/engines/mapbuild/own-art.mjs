// The GM's own pictures for walls, doors and roofs: which they have picked, and whether a picture suits what it was
// picked for.
//
// A wall, a door leaf and a roof can each be covered with a picture the GM owns instead of our painted one
// (engines/motion/roof-cover.mjs). This is the list of the ones they have picked — "Yours", beside our own materials
// on the bar — and the few judgements a picture needs: a strip of wall is long and thin and is not one of the corner
// pieces sold beside it; a picture cannot say what it is made of, so how it weathers is guessed from its name.
//
// It also reads what an asset browser shows of an asset. The GM's own asset browser (another module's window) marks
// each asset it lists with plain facts — its name, where it is kept, its size — and picking one there is the natural
// way to choose it. Nothing of that module is used but what it shows on the page the GM clicked: no code of its, no
// call to its service. (Roi, of a file browser and then of taking a picture from a tile: "can we integrate it better";
// "i dont see many users will use eyedrop feature".) All pure.

import { STANDS, standsAs } from '../motion/tile-props.mjs';

/** What a picture can be picked for. */
export const OWN_ART_KINDS = Object.freeze(['wall', 'door', 'roof', 'window', 'decor', 'ground']);
/** How many are kept of each: the row on the bar is a row, not a library. */
export const OWN_ART_MOST = 16;

const clean = (text, most) => String(text ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, most);
const fileName = (path) => { try { return decodeURIComponent(String(path ?? '').split(/[?#]/)[0].split('/').pop() ?? ''); } catch { return String(path ?? ''); } };
/** A picture's name as a person would say it, from where it is kept (pure). */
export const artName = (path) => fileName(path).replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

/**
 * What an asset browser's card says of its asset (pure): `data` the card's own facts (its dataset), `thumb` the
 * address of the small picture it shows. Returns { name, path, url, thumb, width, height, locked } or null when the
 * card says too little. `url` is the picture itself: where the card gives a whole address, that; where it gives only
 * where the asset is kept within the browser's library and shows a thumbnail from that library, the same library's
 * full pictures; where neither can be told, nothing — and `locked` when the browser marks it as not the GM's to use.
 */
export function cardAsset(data = {}, thumb = '') {
  const path = clean(data.contentPath || data.url || '', 400), given = clean(data.url || '', 400), small = clean(thumb, 600);
  if (!path || /^data:/i.test(path)) return null;
  const tier = String(data.tier ?? '').toLowerCase(), locked = (tier && tier !== 'free') || data.locked === 'true';
  let url = null;
  if (/^(https?:)?\/\//i.test(given)) url = given;
  else if (String(data.source ?? '') === 'local') url = given || path;
  else {
    // (A library that serves its thumbnails from one folder serves its pictures from the one beside it.)
    const at = small.indexOf('/thumbnails/');
    if (at > 0 && /^https?:\/\//i.test(small)) url = `${small.slice(0, at)}/free_assets/${path.split('/').map((s) => encodeURIComponent(s).replace(/%21/g, '!')).join('/')}`;
  }
  const name = clean(data.name, 60) || artName(path);
  return { name, path, url: locked ? null : url, thumb: /^data:/i.test(small) ? '' : small, width: Number(data.width) || 0, height: Number(data.height) || 0, locked: !!locked };
}

const WRONG_PIECE = /(?:^|[^a-z])(corner|joint|ending|connector|diag|straight_[a-d])(?=$|[^a-z])/i;
/**
 * Whether a picture suits what it was picked for (pure): { ok, why }. `what` 'wall', 'door' or 'roof'; `art`
 * { name, path, width, height }. A wall wants the long strip, not the corner, joint or end pieces sold with it (we cut
 * our own corners, at any angle); a door wants a leaf seen from above, not its frame or a door lying broken; a roof
 * wants roofing. A picture whose size is not known is judged by its name alone.
 */
export function artSuits(what, art = {}) {
  const name = `${fileName(art.path)} ${art.name ?? ''}`, w = Number(art.width) || 0, h = Number(art.height) || 0, sized = w > 0 && h > 0;
  if (art.locked) return { ok: false, why: 'That one is locked in your asset browser. Pick one you have.' };
  if (what === 'wall') {
    if (WRONG_PIECE.test(name.replace(/straight_path/i, 'path'))) return { ok: false, why: 'That is a corner, joint or end piece. Pick the long strip of the same wall (its name ends "Path"): the corners are cut here, at any angle.' };
    if (sized && w < h * 3) return { ok: false, why: 'A wall wants a long strip of wall (its name usually ends "Path"). That picture is not one.' };
    return { ok: true, why: '' };
  }
  if (what === 'door') {
    if (/frame|fallen|broken|trapdoor|manhole|cellar/i.test(name)) return { ok: false, why: 'A door wants the leaf itself, seen from above: not its frame, a door lying broken, or a trapdoor.' };
    if (!/door|gate/i.test(name)) return { ok: false, why: 'That does not look like a door. Pick a door leaf, seen from above.' };
    return { ok: true, why: '' };
  }
  if (what === 'ground') {
    if (sized && (w > h * 2.5 || h > w * 2.5)) return { ok: false, why: 'Ground wants a square of ground that repeats (a texture), not a strip or a single thing.' };
    if (sized && Math.max(w, h) < 400) return { ok: false, why: 'Ground wants a texture that repeats across the floor. That picture is one small thing: lay it as a decoration.' };
    return { ok: true, why: '' };
  }
  // (Anything can be a decoration: a barrel, a cart, a rug.)
  if (what === 'decor') return { ok: true, why: '' };
  if (what === 'window') {
    if (/sill|frame|broken|shard|curtain_rod/i.test(name)) return { ok: false, why: 'A window wants the window itself, seen from above: not its sill or frame alone, nor one broken.' };
    if (!/window/i.test(name)) return { ok: false, why: 'That does not look like a window. Pick a window, seen from above.' };
    return { ok: true, why: '' };
  }
  if (what === 'roof') {
    if (!/roof|shingle|slate|thatch|hay|tile|corrugated/i.test(name)) return { ok: false, why: 'A roof wants roofing: a tile, slate, shingle or thatch texture.' };
    if (sized && (w > h * 2.5 || h > w * 2.5)) return { ok: false, why: 'A roof wants a square of roofing, not a strip.' };
    return { ok: true, why: '' };
  }
  return { ok: false, why: '' };
}

/**
 * What a picture is taken to be made of, by its name (pure): one of our own materials (a wall's) or coverings (a
 * roof's), which is what says how moss, snow and the years sit on it. Nothing for a door.
 */
export function weathersAs(what, name = '') {
  const n = String(name).toLowerCase();
  if (what === 'wall') return /brick/.test(n) ? 'brick' : /plaster|adobe|clay|mud/.test(n) ? 'adobe' : /palisade|log/.test(n) ? 'palisade' : /wood|timber|plank|shack/.test(n) && !/stone/.test(n) ? 'timber' : /field|rubble|rough/.test(n) ? 'fieldstone' : 'dressed';
  if (what === 'roof') return /hay|thatch|straw/.test(n) ? 'thatch' : /slate/.test(n) ? 'slate' : /shingle|wood/.test(n) ? 'shingle' : /metal|corrugated|lead|copper/.test(n) ? 'lead' : 'tile';
  // (Ground's is which of our own paths it is laid as: how wide by habit, how soft its edge.)
  if (what === 'ground') return /cobble|stone|brick|pav|flag|tile|marble|slab/.test(n) ? 'street' : /gravel|pebble|sand|ash/.test(n) ? 'gravel' : /wood|plank|board|deck/.test(n) ? 'boardwalk' : /grass|moss|leaf|leaves|forest|crop|field/.test(n) ? 'track' : 'road';
  // (A decoration's is how it stands: flat on the ground, low, waist high or tall — how long its shadow is.)
  if (what === 'decor') return standsAs(name);
  // (A window's is which of our own windows it behaves as: whether it opens, what comes through it.)
  if (what === 'window') return /stained|mosaic|colou?r/.test(n) ? 'mosaicWindow' : /wired|lead|lattice|diamond/.test(n) ? 'leadedWindow' : /shutter/.test(n) ? 'shutterWindow' : /bar(red|s)\b|grate|grill/.test(n) ? 'barredWindow' : /frost|paper/.test(n) ? 'frostedWindow' : /wood|shack|board/.test(n) && !/glass/.test(n) ? 'woodWindow' : 'glassWindow';
  return '';
}

/**
 * One of the GM's own pictures laid as a decoration by the brush (pure), or null where there is no room: 'own' { url,
 * size (its longer side in squares), as (how it stands) }; within 'radius' of (x, y), clear of what stands in
 * 'existing', 'scale' times its size, turned 'turn' (else its own way, a little). A decoration like any other but
 * for its kind — it stands, or lies flat — and 'art', where its picture is kept.
 */
export function stampOwn({ x = 0, y = 0, radius = 0, grid = 100, own, seed = 1, existing = [], scale = 1, turn = null } = {}) {
  if (!own?.url) return null;
  let s = (Math.imul(Number(seed) | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  const rng = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0; return s / 4294967296; };
  const flat = own.as === 'flat', size = Math.min(12, Math.max(0.2, (Number(own.size) > 0 ? Number(own.size) : 1) * (Number(scale) || 1)));
  for (let t = 0; t < 6; t++) {
    const a = rng() * 6.283, far = Math.sqrt(rng()) * radius, px = x + Math.cos(a) * far, py = y + Math.sin(a) * far;
    const free = flat || existing.every((e) => e.kind === 'ownArtFlat' || e.lies === true || (e.x - px) ** 2 + (e.y - py) ** 2 > ((e.size + size) * grid * 0.42) ** 2);
    if (!free) continue;
    const d = { kind: flat ? 'ownArtFlat' : 'ownArt', art: own.url, x: Math.round(px), y: Math.round(py), size: +size.toFixed(3), turn: +(rng() * 6.283).toFixed(3), seed: (rng() * 2 ** 31) >>> 0, flip: false, high: STANDS[own.as] ?? STANDS.waist };
    if (Number.isFinite(turn)) { d.turn = +Number(turn).toFixed(3); d.fixed = true; }
    return d;
  }
  return null;
}

/** The GM's pictures as kept (pure): cleaned, each { what, url, name, thumb, as }, none twice, the newest first. */
export function ownArtList(raw) {
  const seen = new Set(), out = [];
  for (const it of Array.isArray(raw) ? raw : []) {
    const what = OWN_ART_KINDS.includes(it?.what) ? it.what : null, url = typeof it?.url === 'string' ? clean(it.url, 400) : '';
    if (!what || !url || /^(javascript|data):/i.test(url) || seen.has(`${what}|${url}`)) continue;
    seen.add(`${what}|${url}`);
    out.push({ what, url, name: clean(it.name, 60) || artName(url), thumb: typeof it.thumb === 'string' && !/^(javascript|data):/i.test(it.thumb) ? clean(it.thumb, 600) : '', as: clean(it.as, 24) || weathersAs(what, it.name || url), ...(Number(it.size) > 0 ? { size: Math.min(12, Math.max(0.25, Number(it.size))) } : {}) });
  }
  return out;
}
/** The list with one more picture at its head (pure); one already there moves to the head. No more than OWN_ART_MOST of a kind. */
export function withOwnArt(raw, item) {
  const [one] = ownArtList([item]); if (!one) return ownArtList(raw);
  const rest = ownArtList(raw).filter((it) => !(it.what === one.what && it.url === one.url)), kept = {};
  return [one, ...rest].filter((it) => (kept[it.what] = (kept[it.what] ?? 0) + 1) <= OWN_ART_MOST);
}
/** The list without one (pure). */
export const withoutOwnArt = (raw, what, url) => ownArtList(raw).filter((it) => !(it.what === what && it.url === url));
/** The list with one's material changed (pure). */
export const ownArtAs = (raw, what, url, as) => ownArtList(raw).map((it) => (it.what === what && it.url === url ? { ...it, as: clean(as, 24) } : it));
