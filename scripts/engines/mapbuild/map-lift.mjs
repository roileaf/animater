// A thing lifted out of the map's own picture (pure).
//
// A battlemap arrives as one picture: its bushes, rocks and barrels are paint on the same sheet as the grass. A GM who
// clicks one of them has it cut out of that picture and stood on the map as a tile of its own, exactly over where it
// was painted — and a tile is something the engines work on (tile-props.mjs): it throws a shadow that turns with the
// sun, takes the ground's snow and rain, and can be made to break. Nothing is taken out of the map's picture: the
// thing stays painted underneath, so there is no hole to mend unless it is later moved away.
//
// (A table's suggestion: "making maps more interactable... to select objects on a maps background (like bushes, tree,
// rocks, and so forth) to make them into a tile which can interact with animaters configurations". The outline comes
// from the module's own segmentation model, ui/smart-model.mjs, which the Map painting brush already asks.)

/** How a lifted thing stands, in squares: how long its shadow is. A hollow, a stain or a rug lies flat and casts none. */
export const LIFT_STANDS = Object.freeze({ flat: 0, low: 0.3, waist: 0.6, tall: 1, bush: 1.2, tree: 5 });
export const LIFT_CHOICES = Object.freeze([['flat', 'Flat'], ['low', 'Low'], ['waist', 'Waist'], ['tall', 'Tall'], ['bush', 'A bush'], ['tree', 'A tree']]);
/**
 * The ones that grow: a bush or a tree is not an object with a hard shadow but a crown the sun comes through. Its tile
 * is a tree tile (canopy-light.mjs): shade dappled in its own kind's pattern, flecks of sun that move, and all of it
 * swaying with the wind. Which kind of tree (tree-kinds.mjs TREE_KINDS) is the GM's to say; a broadleaf unless told.
 */
export const LIFT_GROWS = Object.freeze(['bush', 'tree']);
export const LIFT_TREES = Object.freeze([['broadleaf', 'Broadleaf'], ['pine', 'Pine'], ['spruce', 'Spruce'], ['palm', 'Palm'], ['birch', 'Birch'], ['blossom', 'Blossom'], ['bare', 'Bare'], ['willow', 'Willow']]);
/**
 * What a lifted thing is made of, said as it is lifted (the brush's Breaks): that is what makes a tile break (props/
 * prop-material.mjs), and a piece cut from the map has no name for it to be guessed from. Won't says nothing, which
 * leaves it to the region it stands in (props/lifted-props.mjs). A bush or a tree only ever burns.
 */
export const LIFT_BREAKS = Object.freeze([['no', "Won't"], ['wood', 'Wood'], ['stone', 'Stone'], ['metal', 'Metal'], ['clay', 'Clay'], ['glass', 'Glass']]);
export const LIFT_BURNS = Object.freeze([['no', "Won't"], ['plant', 'Burns']]);
/** The most pixels a side a cut picture is kept at: bigger is scaled down, since it is laid at its own size anyway. */
export const LIFT_MOST = 2048;

/**
 * Of the model's nested answers for a click, the outline of the thing under it (pure): the one it is surest of that
 * is neither a speck nor a great part of the map — a click on a bush that answers with the whole meadow is no bush.
 * `masks` each one value a pixel (anything but 0 is in), `scores` the model's own for each. A Uint8Array of 0s and
 * 1s, or null.
 */
export function liftMask({ masks = [], scores = [], width = 0, height = 0, least = 0.0003, most = 0.12 } = {}) {
  const n = width * height; if (!(n > 0)) return null;
  let best = null;
  masks.forEach((m, i) => {
    if (!m || m.length < n) return;
    let count = 0; for (let k = 0; k < n; k++) if (m[k]) count++;
    const share = count / n, score = Number(scores[i]) || 0;
    if (share < least || share > most) return;
    if (!best || score > best.score) best = { m, score };
  });
  if (!best) return null;
  const out = new Uint8Array(n); for (let k = 0; k < n; k++) out[k] = best.m[k] ? 1 : 0;
  return out;
}

/** The box a mask fills (pure): { x, y, w, h, count } in its own pixels, or null when it is empty. */
export function maskBox(mask, width, height) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1, count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; count++; }
  return count ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, count } : null;
}

/**
 * The same box with a little room round it, kept on the picture (pure): a cut-out wants a margin for its soft edge.
 */
export function roomyBox(box, width, height, pad = 2) {
  const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
  return { x, y, w: Math.min(width, box.x + box.w + pad) - x, h: Math.min(height, box.y + box.h + pad) - y };
}

/**
 * Where a box of the read map lies on the scene and in the map's full picture (pure). `map` { width, height (as
 * read), rect { x, y, width, height } (where the map lies on the scene) }, `natural` { width, height } of the
 * picture itself. Returns { scene: { x, y, width, height }, source: { x, y, width, height }, cut: { width, height } }
 * — the cut being the size the picture is kept at, never over LIFT_MOST a side.
 */
export function liftPlaces(box, map, natural) {
  const kx = map.rect.width / map.width, ky = map.rect.height / map.height, nx = natural.width / map.width, ny = natural.height / map.height;
  const source = { x: box.x * nx, y: box.y * ny, width: box.w * nx, height: box.h * ny }, shrink = Math.min(1, LIFT_MOST / Math.max(source.width, source.height, 1));
  return { scene: { x: map.rect.x + box.x * kx, y: map.rect.y + box.y * ky, width: box.w * kx, height: box.h * ky }, source, cut: { width: Math.max(1, Math.round(source.width * shrink)), height: Math.max(1, Math.round(source.height * shrink)) } };
}

/**
 * A piece of the map's picture with everything but the thing made clear (pure). `rgba` the piece (cw by ch), cut from
 * the picture over `box` of the mask; `mask` the outline (0s and 1s, mw wide). The mask is usually coarser than the
 * picture, so it is read smoothly between its pixels and its edge made a soft one: the thing does not sit on the map
 * like a sticker, nor come out in steps.
 */
export function cutPixels(rgba, cw, ch, mask, mw, mh, box) {
  const out = new Uint8ClampedArray(rgba), at = (x, y) => (x < 0 || y < 0 || x >= mw || y >= mh ? 0 : mask[y * mw + x]);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const mx = box.x + ((x + 0.5) / cw) * box.w - 0.5, my = box.y + ((y + 0.5) / ch) * box.h - 0.5, x0 = Math.floor(mx), y0 = Math.floor(my), fx = mx - x0, fy = my - y0;
    const a = at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
    const t = Math.max(0, Math.min(1, (a - 0.3) / 0.4));
    out[(y * cw + x) * 4 + 3] = Math.round(rgba[(y * cw + x) * 4 + 3] * t * t * (3 - 2 * t));
  }
  return out;
}

/**
 * The tile a lifted thing is laid as (pure): its picture, where it was painted, and told to stand as an object so the
 * engines take it (flags.animater.sunlight: 'prop'), as tall as `stands` says in the scene's own units (`per` to a
 * square). One that grows (LIFT_GROWS) is told to be a tree instead (sunlight: 'tree', sunTree: its kind `tree`). A tile's place is its middle. `levelId` the level it is on, `elevation` that level's floor.
 * `breaks` what it is made of (LIFT_BREAKS; one that grows is a plant whichever was picked): written as the tile's own
 * material, so it breaks. Won't, or nothing, writes none.
 */
export function liftTileData({ src, scene, stands = 'waist', tree = 'broadleaf', per = 5, levelId = null, elevation = 0, breaks = 'no' } = {}) {
  if (typeof src !== 'string' || !src || !(scene?.width > 0) || !(scene?.height > 0)) return null;
  const high = LIFT_STANDS[stands] ?? LIFT_STANDS.waist, grows = LIFT_GROWS.includes(stands), kind = LIFT_TREES.some(([k]) => k === tree) ? tree : 'broadleaf';
  const said = breaks !== 'no' && (LIFT_BREAKS.some(([k]) => k === breaks) || (grows && breaks === 'plant')), material = said ? (grows ? 'plant' : breaks) : null;
  return {
    texture: { src, anchorX: 0.5, anchorY: 0.5 }, x: Math.round(scene.x + scene.width / 2), y: Math.round(scene.y + scene.height / 2), width: Math.round(scene.width), height: Math.round(scene.height), rotation: 0,
    elevation: Number(elevation) || 0, ...(levelId ? { levels: [levelId] } : {}),
    flags: { animater: { sunlight: grows ? 'tree' : 'prop', ...(grows ? { sunTree: kind } : {}), sunHeight: +(high * (Number(per) || 5)).toFixed(2), lifted: true, ...(material ? { prop: { material } } : {}) } },
  };
}
