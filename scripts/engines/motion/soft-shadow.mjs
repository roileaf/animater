// A flier's shadow by how high it is: the sun's rays spread a little, so the higher the flier the wider, softer and fainter its shadow. The soft copies are drawn once for each picture, on first use, so this costs nothing frame to frame.

const INSET = 0.12, BLUR = [0, 0.012, 0.03];

// How soft a shadow is (pure), 0 crisp to 2 softest, from how many squares up the flier really is.
export const shadowSoftness = (squares) => (squares < 3 ? 0 : squares < 8 ? 1 : 2);
// How its shadow looks (pure): `lift` how high this bird usually flies, in squares, `share` the map's Bird height as a share of the usual. grow: how much wider; fade: how much fainter, on top of the fading with distance.
export const highShadowLook = (lift, share = 1) => ({ level: shadowSoftness(lift * share), grow: 1 + 0.15 * (share - 1), fade: 1 / (1 + 0.35 * Math.max(0, share - 1)) });

// The soft copies. of(texture, level) gives { texture, scale }, `scale` what keeps it the size of the picture it came from (a soft copy is drawn smaller within its frame, to leave its blur room). Where one cannot be drawn, the picture as it is.
export function createSoftShadows({ PIXI, document = globalThis.document }) {
  const made = new Map();
  const draw = (texture, level) => {
    const source = texture?.baseTexture?.resource?.source, frame = texture?.frame;
    if (!source || !frame || !(frame.width > 0) || !document?.createElement) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(frame.width); canvas.height = Math.ceil(frame.height);
    const g = canvas.getContext('2d');
    // (Not every browser blurs a canvas: then it stays crisp.)
    if (!g || typeof g.filter !== 'string') return null;
    g.filter = `blur(${Math.max(1, frame.width * BLUR[level]).toFixed(2)}px)`;
    g.drawImage(source, frame.x, frame.y, frame.width, frame.height, frame.width * INSET, frame.height * INSET, frame.width * (1 - 2 * INSET), frame.height * (1 - 2 * INSET));
    return new PIXI.Texture(new PIXI.BaseTexture(canvas));
  };
  return {
    of(texture, level = 0) {
      if (!(level > 0)) return { texture, scale: 1 };
      let copies = made.get(texture);
      if (!copies) { copies = []; made.set(texture, copies); }
      if (copies[level] === undefined) { try { copies[level] = draw(texture, level); } catch { copies[level] = null; } }
      return copies[level] ? { texture: copies[level], scale: 1 / (1 - 2 * INSET) } : { texture, scale: 1 };
    },
    clear() { for (const copies of made.values()) for (const copy of copies) { try { copy?.destroy(true); } catch { /* gone */ } } made.clear(); },
    get size() { let n = 0; for (const copies of made.values()) n += copies.filter(Boolean).length; return n; },
  };
}
