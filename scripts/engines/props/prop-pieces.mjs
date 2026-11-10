// Pieces cut from a prop's own art that move to a pose: each one a polygon of the tile's picture with an ink line
// along its cut (and a pale fresh edge where it snapped), going from where it sat to where it lands with a short hop,
// bigger and its shadow further off while in the air. Collapse uses it; tip and topple reuse it.
// A piece: {poly (tile-local px), home: {x, y}, to: {x, y, rot, sx?, sy?}, delay, dur (shares of the 0-1 timeline),
// edge? (the snapped line, tile-local), fresh? (a CSS colour stroked inside the whole cut when there is no edge: a
// charred stave), hop?, shadow?, ink? (false: no ink line, for a whole picture that never snapped)}.

const K_MAX = 2, SIDE_MAX = 2048, ALPHA_CUT = 90;
const FRESH = "rgba(214,180,124,0.9)", INK = "rgba(20,15,10,0.85)";
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const outCubic = (u) => 1 - (1 - u) ** 3;
const quiet = (fn) => { try { fn(); } catch { /* keep cleaning */ } };

// A container laid over the tile: children placed in tile-local px (origin at the tile's top-left, unturned) land
// where the tile's art is. stand: the unseen sprite drawn the way Foundry draws the tile; size: the tile's width/height.
export function tileFrame(PIXI, stand, { width, height }) {
  const f = new PIXI.Container();
  f.position.set(stand.position.x, stand.position.y); f.rotation = stand.rotation;
  f.pivot.set(stand.anchor.x * width, stand.anchor.y * height);
  return f;
}

export function createPosedPieces({ PIXI }) {
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  // The tile's picture in tile-local px times k, its soft drop shadow cut away so the cut edges stay clean. Null when
  // the art can't be read back (a video, or no source).
  function artCanvas(stand, w, h, k) {
    const tex = stand.texture, src = tex?.baseTexture?.resource?.source, fr = tex?.frame;
    if (!src || !fr || typeof HTMLVideoElement !== "undefined" && src instanceof HTMLVideoElement) return null;
    const c = canvas(w * k, h * k), x = c.getContext("2d");
    x.setTransform(k, 0, 0, k, 0, 0);
    x.translate(stand.anchor.x * w, stand.anchor.y * h); x.scale(stand.scale.x, stand.scale.y);
    x.drawImage(src, fr.x, fr.y, fr.width, fr.height, -stand.anchor.x * fr.width, -stand.anchor.y * fr.height, fr.width, fr.height);
    const d = x.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] < ALPHA_CUT ? 0 : Math.min(255, ((d.data[i] - ALPHA_CUT) * 255) / (255 - ALPHA_CUT));
    x.setTransform(1, 0, 0, 1, 0, 0); x.putImageData(d, 0, 0);
    return c;
  }

  // One piece's texture: the art clipped to its polygon, the fresh edge, then the ink line, both only where there is paint.
  function cutTexture(art, p, k) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.poly.length; i += 2) { x0 = Math.min(x0, p.poly[i]); x1 = Math.max(x1, p.poly[i]); y0 = Math.min(y0, p.poly[i + 1]); y1 = Math.max(y1, p.poly[i + 1]); }
    const pad = 3, c = canvas((x1 - x0) * k + pad * 2, (y1 - y0) * k + pad * 2), g = c.getContext("2d");
    g.translate(pad - x0 * k, pad - y0 * k);
    const line = (pts, close) => { g.beginPath(); g.moveTo(pts[0] * k, pts[1] * k); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * k, pts[i + 1] * k); if (close) g.closePath(); };
    g.save(); line(p.poly, true); g.clip(); g.drawImage(art, 0, 0);
    g.globalCompositeOperation = "source-atop"; g.lineJoin = "round";
    if (p.edge) { g.strokeStyle = FRESH; g.lineWidth = 1.4 * k * 2.4; line(p.edge, false); g.stroke(); }
    else if (p.fresh) { g.strokeStyle = p.fresh; g.lineWidth = 1.3 * k * 2.4; line(p.poly, true); g.stroke(); } // a charred stave: dark all round
    if (p.ink !== false) { g.strokeStyle = INK; g.lineWidth = 1.4 * k; line(p.poly, true); g.stroke(); }
    g.restore();
    return { tex: PIXI.Texture.from(c), ax: (p.home.x - x0) * k + pad, ay: (p.home.y - y0) * k + pad };
  }

  // Where the art can't be read back: the tile's sprite masked by the polygon (no ink line).
  function maskedPiece(stand, p, w, h) {
    const c = new PIXI.Container(), s = new PIXI.Sprite(stand.texture), m = new PIXI.Graphics();
    s.anchor.copyFrom(stand.anchor); s.scale.copyFrom(stand.scale); s.position.set(stand.anchor.x * w, stand.anchor.y * h);
    m.beginFill(0xffffff).drawPolygon(p.poly).endFill();
    c.addChild(s, m); s.mask = m; c.pivot.set(p.home.x, p.home.y);
    return c;
  }

  function cut(stand, pieces, size = {}) {
    const w = size.width ?? Math.abs(stand.texture.width * stand.scale.x), h = size.height ?? Math.abs(stand.texture.height * stand.scale.y);
    const k = Math.min(K_MAX, SIDE_MAX / Math.max(w, h, 1)), textures = [];
    let art = null;
    try { art = artCanvas(stand, w, h, k); } catch { art = null; } // a tainted or unreadable picture: masked pieces instead
    const shadows = tileFrame(PIXI, stand, { width: w, height: h }), front = tileFrame(PIXI, stand, { width: w, height: h });
    const z = stand.zIndex ?? 0;
    shadows.zIndex = z - 0.6; front.zIndex = z + 0.01;
    for (const f of [shadows, front]) { f.elevation = stand.elevation; f.sort = stand.sort; if (stand.sortLayer !== undefined) f.sortLayer = stand.sortLayer; }
    stand.parent?.addChild(shadows, front);
    // A world-space offset (the shadow falls down-right, a hop lifts up the screen) in the tile's turned frame.
    const ca = Math.cos(-stand.rotation), sa = Math.sin(-stand.rotation), local = (x, y) => [x * ca - y * sa, x * sa + y * ca];

    const posed = pieces.map((p) => {
      let body, shade, base = 1;
      if (art) {
        const { tex, ax, ay } = cutTexture(art, p, k); textures.push(tex);
        body = new PIXI.Sprite(tex); shade = new PIXI.Sprite(tex);
        for (const s of [body, shade]) s.anchor.set(ax / tex.width, ay / tex.height);
        base = 1 / k;
      } else { body = maskedPiece(stand, p, w, h); shade = maskedPiece(stand, p, w, h); }
      if (shade.tint !== undefined) shade.tint = 0x000000; else shade.children[0].tint = 0x000000;
      shadows.addChild(shade); front.addChild(body);
      return { p, body, shade, base };
    });

    function update(t) {
      for (const { p, body, shade, base } of posed) {
        const r = clamp01((t - (p.delay ?? 0)) / Math.max(1e-6, p.dur ?? 1)), u = outCubic(r);
        const lift = Math.sin(Math.PI * r) * (p.hop ?? 0.12), to = p.to, home = p.home ?? to;
        const x = lerp(home.x, to.x, u), y = lerp(home.y, to.y, u), [lx, ly] = local(0, -lift * 18);
        body.position.set(x + lx, y + ly); body.rotation = lerp(0, to.rot ?? 0, u);
        const sc = base * (1 + lift * 0.25);
        body.scale.set(sc * (to.sx ?? 1) ** u, sc * (to.sy ?? 1) ** u);
        const [sx, sy] = local(2.5 + lift * 10, 4 + lift * 16);
        shade.position.set(x + sx, y + sy); shade.rotation = body.rotation; shade.scale.copyFrom(body.scale);
        shade.alpha = (p.shadow ?? 0.38) * (1 - lift * 0.5);
      }
    }

    // Tints every piece (a tipped brazier cools); white leaves the art as it is.
    function tint(colour) {
      for (const { body } of posed) { if (body.tint !== undefined) body.tint = colour; else body.children[0].tint = colour; }
    }

    function destroy() {
      quiet(() => shadows.destroy({ children: true }));
      quiet(() => front.destroy({ children: true }));
      for (const t of textures) quiet(() => t.destroy(true));
      textures.length = 0;
    }

    update(0);
    return { update, tint, destroy };
  }

  return { cut };
}
