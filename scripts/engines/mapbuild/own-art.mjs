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

/** What a picture can be picked for. */
export const OWN_ART_KINDS = Object.freeze(['wall', 'door', 'roof']);
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
  return '';
}

/** The GM's pictures as kept (pure): cleaned, each { what, url, name, thumb, as }, none twice, the newest first. */
export function ownArtList(raw) {
  const seen = new Set(), out = [];
  for (const it of Array.isArray(raw) ? raw : []) {
    const what = OWN_ART_KINDS.includes(it?.what) ? it.what : null, url = typeof it?.url === 'string' ? clean(it.url, 400) : '';
    if (!what || !url || /^(javascript|data):/i.test(url) || seen.has(`${what}|${url}`)) continue;
    seen.add(`${what}|${url}`);
    out.push({ what, url, name: clean(it.name, 60) || artName(url), thumb: typeof it.thumb === 'string' && !/^(javascript|data):/i.test(it.thumb) ? clean(it.thumb, 600) : '', as: clean(it.as, 24) || weathersAs(what, it.name || url) });
  }
  return out;
}
/** The list with one more picture at its head (pure); one already there moves to the head. No more than OWN_ART_MOST of a kind. */
export function withOwnArt(raw, item) {
  const [one] = ownArtList([item]); if (!one) return ownArtList(raw);
  const rest = ownArtList(raw).filter((it) => !(it.what === one.what && it.url === one.url)), kept = { wall: 0, door: 0, roof: 0 };
  return [one, ...rest].filter((it) => ++kept[it.what] <= OWN_ART_MOST);
}
/** The list without one (pure). */
export const withoutOwnArt = (raw, what, url) => ownArtList(raw).filter((it) => !(it.what === what && it.url === url));
/** The list with one's material changed (pure). */
export const ownArtAs = (raw, what, url, as) => ownArtList(raw).map((it) => (it.what === what && it.url === url ? { ...it, as: clean(as, 24) } : it));
