// Which of a scene's tiles stand on the map as things, and how high.
//
// A GM who builds a map out of pictures (an asset pack laid down as tiles: a barrel here, a cart there, a bush) has
// already placed every one of them; all that is missing is that they stand in the world — that they throw a shadow
// which turns with the sun, another from a torch carried past, that snow lies on them. The decoration engine does
// that for our own painted pieces (decorations.mjs); this says which tiles it should do it for as well, and the few
// things about each that its picture cannot say. All of it pure.
//
// (Roi, of the painted kit beside an asset pack's art: "i still see huge distinction between the quality"; then, of
// the pack's own placing tool: "can we integrate". So nothing is painted and nothing is picked here: the tiles are the
// GM's, placed with whatever they like, and only read.)

const nameOf = (src) => { try { return decodeURIComponent(String(src ?? '').split(/[?#]/)[0].split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, ''); } catch { return String(src ?? ''); } };
const word = (list) => new RegExp(`(?:^|[^a-z])(${list})(?=$|[^a-z])`, 'i');
// What lies on the ground and stands no height at all, by what it is called.
const FLAT = word('rugs?|carpets?|mats?|stains?|blood|puddles?|pools?|cracks?|floors?|paths?|roads?|tracks?|footprints?|scorch|burn|ash|dirt|mud|moss|leaves|petals|shadows?|decals?|overlays?|cobwebs?|webs?|runes?|circles?|symbols?|paint|chalk|water|grass|straw|hay_?floor|tiles?|planks?|trapdoors?|grates?|drains?|hatch');
const TALL = word('statues?|pillars?|columns?|obelisks?|carts?|wagons?|carriages?|boulders?|tents?|wells?|wardrobes?|bookshel(?:f|ves)|shel(?:f|ves)|cabinets?|cupboards?|totems?|lamp_?posts?|posts?|poles?|signs?|signposts?|cranes?|gallows|scaffolds?|stalls?|fountains?|altars?|thrones?|ovens?|furnaces?|forges?|kilns?|looms?|presses?|racks?|stalagmites?|monoliths?|menhirs?|haystacks?|coaches?');
const LOW = word('sacks?|bags?|campfires?|firepits?|bedrolls?|bones?|skulls?|stumps?|pebbles?|logs?|buckets?|pots?|pans?|plates?|bowls?|books?|scrolls?|pillows?|cushions?|baskets?|stools?|plants?|flowers?|rocks?|stones?|rubble|debris|tools?|weapons?|swords?|shields?|bottles?|mugs?|cups?|candles?|coins?|trays?|bandages?|ropes?|chains?|nets?|traps?|food|bread|fish|fruit|vegetables?|corpses?|bodies|body|remains|firewood|ingots?|ore');
const FIRE = word('campfires?|firepits?|bonfires?|braziers?|fires?|torch(?:es)?|flames?|embers?|lava|forges?|furnaces?');
const UNLIT = word('unlit|out|cold|dead|empty|extinguished');

/** The choices a tile has for standing as a thing (Tile configuration → Animater): its own say, over the scene's. */
export const PROP_CHOICE = 'prop';
/** How big a tile may be, on its longer side in squares, to be taken for a thing by itself: past that it is a floor, a building, a map. */
export const PROP_MOST_SQUARES = 9;
/** How much of its rectangle a tile's picture may fill and still be a thing: a floor fills all of its own. */
export const PROP_SOLID = 0.93;

/**
 * Whether a tile stands on the map as a thing (pure).
 *   choice    its own setting (flags.animater.sunlight): 'prop' always does; 'none', 'tree' and 'roof' never.
 *   on        the scene's switch for doing this by itself (off unless the GM turns it on).
 *   overhead  it is above its level's floor (a roof, a canopy): those are the canopy's.
 *   solid     how much of its rectangle its picture fills, 0-1 (unknown: null).
 *   squares   its longer side, in squares.
 */
export function tileProp({ choice = '', on = false, overhead = false, solid = null, squares = 1, src = '' } = {}) {
  if (choice === PROP_CHOICE) return true;
  if (choice === 'none' || choice === 'tree' || choice === 'roof') return false;
  if (!on || overhead) return false;
  if (!(squares > 0) || squares > PROP_MOST_SQUARES) return false;
  if (FLAT.test(nameOf(src)) && !TALL.test(nameOf(src))) return false;
  // (A picture that could not be read is given the benefit of the doubt when it is small: most small tiles are things.)
  return Number.isFinite(solid) ? solid < PROP_SOLID : squares <= 4;
}

/**
 * How high a tile stands, in squares (pure): its own Height (in the scene's units, `per` to a square) when it has one,
 * else by what it is called — a statue, a cart and a boulder tall; a sack, a campfire and a stump low — else waist
 * high. Never taller than it is wide by much: a pebble called "Boulder" is still a pebble.
 */
export function propHeight({ src = '', own = null, per = 5, squares = 1 } = {}) {
  const units = Number(own);
  if (own !== null && own !== '' && Number.isFinite(units) && units >= 0) return units / (Number(per) || 5);
  const name = nameOf(src), guess = TALL.test(name) ? 1 : LOW.test(name) ? 0.3 : 0.6;
  return Math.min(guess, Math.max(0.15, (Number(squares) || 1) * 1.2));
}

/** Whether a tile is a fire burning (pure), by what it is called: no snow lies on it. */
export const propBurning = (src) => { const name = nameOf(src); return FIRE.test(name) && !UNLIT.test(name); };

/**
 * The tiles standing as things, as the decoration engine takes them (pure): `tiles` what the scene has, each
 * { id, src, choice, own (its Height), hidden, overhead, solid, texture, x, y, width, height, rotation (degrees),
 * alpha, indoors }; `on` the scene's switch; `grid` a square in pixels; `per` the scene's units to a square.
 */
export function tileProps(tiles = [], { on = false, grid = 100, per = 5 } = {}) {
  const out = [];
  for (const t of tiles) {
    if (!t || t.hidden || !t.texture) continue;
    const squares = Math.max(Math.abs(Number(t.width) || 0), Math.abs(Number(t.height) || 0)) / (Number(grid) || 100);
    if (!tileProp({ choice: t.choice, on, overhead: t.overhead, solid: t.solid, squares, src: t.src })) continue;
    out.push({ id: t.id, texture: t.texture, x: t.x, y: t.y, width: t.width, height: t.height, rotation: ((Number(t.rotation) || 0) * Math.PI) / 180, high: propHeight({ src: t.src, own: t.own, per, squares }), alpha: t.alpha ?? 1, indoors: t.indoors === true, snowless: propBurning(t.src) });
  }
  return out;
}
