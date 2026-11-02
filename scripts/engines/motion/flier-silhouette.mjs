// A flier's shadow in its own shape: the token's art drawn once as a soft black silhouette (small, blurred, two
// blurs: sharp for a low flier, soft for a high one), laid flat on the floor below it. Art with no outline of its own
// (an opaque square portrait) keeps the round shadow, as its silhouette would only be a square.

// The size the silhouette is drawn at (its longer side, in pixels): a shadow is soft, so small is enough for a creature
// of a square or so; a bigger one's is drawn bigger (silhouetteSize), its blur the same in pixels, so a dragon's shadow
// is as crisp as a cat's, not stretched six times as soft.
export const SILHOUETTE_SIZE = 128;
// The size to draw a silhouette at for art drawn `drawn` pixels across: 128, 256 or 512.
export const silhouetteSize = (drawn) => { const d = Number(drawn) || 0; return d > 320 ? 512 : d > 160 ? 256 : SILHOUETTE_SIZE; };
// Art that covers more than this share of its frame has no outline to cast.
export const SOLID_COVERAGE = 0.82;
// How much larger than its token a shadow may grow (wide wings, a long tail).
export const MAX_SPREAD = 1.3;

// The share of `alpha` (an RGBA byte array) that is solid.
export function coverageOf(data) {
  let solid = 0, total = 0;
  for (let i = 3; i < data.length; i += 4) { total++; if (data[i] > 128) solid++; }
  return total ? solid / total : 1;
}

// How much of an image `w` × `h` (RGBA bytes) its visible art spans, across and down (0–1): art with wide empty
// margins (a dynamic ring's subject, drawn larger than its token) is measured by the creature, not the image.
export function filledShare(data, w, h) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] <= 32) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? { w: 1, h: 1 } : { w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h };
}

// How the art's silhouette is scaled under a token `width` wide, its visible art `artWidth` × `artHeight`: as drawn,
// shrunk only when it would spread past MAX_SPREAD of the token.
export const silhouetteScale = ({ artWidth, artHeight, width }) => {
  const big = Math.max(Number(artWidth) || 0, Number(artHeight) || 0), w = Number(width) || 0;
  return big > 0 && w > 0 ? Math.min(1, (MAX_SPREAD * w) / big) : 1;
};

// How the silhouette sits for a shadow geometry (movement-feel.mjs shadowGeometry or castShadowGeometry, with its
// `width` and `lift` in squares, and optionally `flat`): `flat` its height kept (laid on the floor, or nearly whole when cast from above),
// `size` its scale (shrinking with height as the round shadow does), `soft` how much of the soft blur shows.
export function silhouettePose(geom, { cast = false } = {}) {
  const lift = Math.max(0, Number(geom?.lift) || 0), w = Number(geom?.width) || 0;
  const size = cast || !(w > 0) ? 1 : Math.min(1, (Number(geom.rx) || 0) / (w * 0.42));
  // `geom.flat`: its own (a standing creature's shadow, under art drawn from above, keeps more of its shape).
  return { flat: Number(geom?.flat) || (cast ? 0.85 : 0.7), size, soft: Math.min(1, lift / 8) };
}

// Silhouette textures, made once per art and kept: `get(texture)` is { sharp, soft, width, height } (the textures
// carry a margin for the blur: `width` × `height` is the art's part of them), or null where the art is solid, not
// loaded yet, or cannot be read (another site's image).
// At most one is made a frame (`gap` ms apart): a scene opening with many creatures shows their round shadows first and
// turns them into their shapes one by one, never a stall.
export function createSilhouettes({ PIXI, doc = globalThis.document, now = () => globalThis.performance?.now?.() ?? Date.now(), gap = 16 } = {}) {
  const made = new Map();
  let lastMade = -Infinity;
  const keyOf = (texture) => {
    const base = texture?.baseTexture, f = texture?.frame;
    return base ? `${base.uid ?? base.cacheId ?? ''}|${f?.x},${f?.y},${f?.width},${f?.height}` : null;
  };
  const make = (texture, size) => {
    const source = texture.baseTexture?.resource?.source, f = texture.frame;
    if (!source || !(f?.width > 0) || !(f?.height > 0) || !doc?.createElement) return null;
    // The full art is shrunk once, to the silhouette's size; the probe and both blurs read that small copy.
    const k = size / Math.max(f.width, f.height), w = Math.max(1, Math.round(f.width * k)), h = Math.max(1, Math.round(f.height * k));
    const small = doc.createElement('canvas');
    small.width = w; small.height = h;
    const s = small.getContext('2d', { willReadFrequently: true });
    s.drawImage(source, f.x, f.y, f.width, f.height, 0, 0, w, h);
    // Solid art (an opaque portrait) casts the round shadow instead.
    const pixels = s.getImageData(0, 0, w, h).data;
    if (coverageOf(pixels) > SOLID_COVERAGE) return null;
    const fill = filledShare(pixels, w, h);
    const draw = (blur) => {
      const pad = Math.ceil(blur * 3), c = doc.createElement('canvas');
      c.width = w + pad * 2; c.height = h + pad * 2;
      const ctx = c.getContext('2d');
      ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(small, pad, pad);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      return { texture: PIXI.Texture.from(c), scale: (w + pad * 2) / w };
    };
    return { sharp: draw(SILHOUETTE_SIZE * 0.025), soft: draw(SILHOUETTE_SIZE * 0.08), width: w, height: h, fill };
  };
  return {
    // `size`: the silhouette's longer side (silhouetteSize of the art as drawn); each size made once.
    get(texture, size = SILHOUETTE_SIZE) {
      const art = keyOf(texture), key = art && `${art}|${size}`;
      if (!key || !texture.valid && texture.valid !== undefined) return null;
      if (!made.has(key)) {
        const time = now();
        if (time - lastMade < gap) return null;
        lastMade = time;
        let shape = null;
        try { shape = make(texture, size); } catch { shape = null; }
        made.set(key, shape);
      }
      return made.get(key);
    },
    // Whether `texture`'s silhouette is settled: made, or known to be solid or unreadable (not still waiting its turn).
    known(texture, size = SILHOUETTE_SIZE) { const art = keyOf(texture); return !art || made.has(`${art}|${size}`); },
    clear() {
      for (const shape of made.values()) for (const t of [shape?.sharp, shape?.soft]) { try { t?.texture.destroy(true); } catch { /* gone */ } }
      made.clear();
    },
  };
}
