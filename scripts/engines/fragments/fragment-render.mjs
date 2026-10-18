// Draws token fragments on each client: pieces of the token's own texture placed where the
// token's art is drawn, moved by fragmentPose, destroyed at the end. Halves and shards are
// masked sprites; dust specks are cropped sub-textures (no masks, so dozens stay cheap).
import { prepareFragments, fragmentPieces, fragmentFlight, fragmentPose, FRAGMENT_TINT_LOOKS } from "./fragments.mjs";

export function createFragmentRenderer({ PIXI, grid }) {
  // Stone's greyscale: one filter shared by every piece this renderer draws, made on first use.
  // Each handle that uses it holds one reference; the last release destroys it. A filter that
  // cannot be made is cached as null, so the pieces go unfiltered and nothing retries.
  let stone, holders = 0;
  const stoneFilter = (amount) => {
    if (stone === undefined) {
      try {
        const Filter = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
        stone = Filter ? new Filter() : null;
        stone?.greyscale(amount, false);
      } catch (error) {
        console.warn("Animater fragments: no stone filter", error);
        try { stone?.destroy?.(); } catch { /* already failing */ }
        stone = null;
      }
    }
    return stone;
  };
  const releaseStone = () => {
    if (--holders > 0) return;
    holders = 0;
    try { stone?.destroy?.(); } catch { /* keep cleaning */ }
    stone = undefined;
  };
  return {
    // `base` is the transform the token is drawn at ({ x, y, rotation, sx, sy }), or a getter for it;
    // without it the live mesh is used. A getter is read every frame, so the pieces follow a rebase.
    start(token, rawStage, cutAngle, baseOrGetter) {
      const baseAt = typeof baseOrGetter === "function" ? baseOrGetter : () => baseOrGetter;
      // A copy: the getter may hand back the same object it later changes.
      const first = baseAt(), base = first ? { ...first } : first;
      const mesh = token?.mesh, texture = mesh?.texture;
      if (!texture || !(token.center || mesh.position)) { console.warn("Animater fragments: no token artwork"); return null; }
      const stage = prepareFragments(rawStage), look = FRAGMENT_TINT_LOOKS[stage.tint] ?? FRAGMENT_TINT_LOOKS.none;
      const layer = mesh.parent ?? globalThis.canvas?.primary, g = grid();
      const sx = base?.sx ?? mesh.scale?.x ?? 1, sy = base?.sy ?? mesh.scale?.y ?? 1;
      const flipX = Math.sign(sx || 1), flipY = Math.sign(sy || 1), turn = base?.rotation ?? mesh.rotation ?? 0;
      // Displayed art size, un-posed: the mesh's own size rescaled from its live scale to the base scale.
      const live = (size, now, was, fallback) => {
        const s = Math.abs(size ?? 0);
        if (!s) return fallback;
        return now && was ? (s * Math.abs(was)) / Math.abs(now) : s;
      };
      const w = live(mesh.width, mesh.scale?.x, sx, token.w), h = live(mesh.height, mesh.scale?.y, sy, token.h);
      // The art's size in squares: implode and absorb aim at points, so their flights need it.
      const size = { w: w / (g || 100), h: h / (g || 100) };
      const rot = (dx, dy) => ({ x: Math.cos(turn) * dx - Math.sin(turn) * dy, y: Math.sin(turn) * dx + Math.cos(turn) * dy });
      // The mesh position sits at the anchor; the art's centre is offset from it.
      const pos = mesh.position ? { x: base?.x ?? mesh.position.x, y: base?.y ?? mesh.position.y } : null;
      const off = pos ? rot((0.5 - (mesh.anchor?.x ?? 0.5)) * w * flipX, (0.5 - (mesh.anchor?.y ?? 0.5)) * h * flipY) : { x: 0, y: 0 };
      const centre = pos ? { x: pos.x + off.x, y: pos.y + off.y } : token.center;
      const place = (dx, dy) => { const r = rot(dx, dy); return { x: centre.x + r.x, y: centre.y + r.y }; };
      const sorting = { elevation: mesh.elevation ?? token.document?.elevation, sortLayer: mesh.sortLayer, sort: mesh.sort };
      const boxes = [], crops = [];
      // This handle's hold on the shared stone filter, taken with its first stone piece.
      let holdsStone = false;
      const release = () => { if (holdsStone) { holdsStone = false; releaseStone(); } };
      let parts;
      try {
        parts = fragmentPieces(stage, cutAngle, turn).map((piece, i) => {
          // The box stays upright and carries the scale and stretch (drip melts down the screen); spin carries the turn.
          const box = new PIXI.Container(), cx = piece.centroid.x * w, cy = piece.centroid.y * h;
          boxes.push(box);
          const spin = new PIXI.Container();
          box.addChild(spin);
          let crop = null, sprite;
          if (piece.rect && texture.baseTexture && texture.frame) {
            const f = texture.frame, rx = flipX < 0 ? -piece.rect.x - piece.rect.w : piece.rect.x, ry = flipY < 0 ? -piece.rect.y - piece.rect.h : piece.rect.y;
            // Whole pixels inside the frame: PIXI throws when a crop overflows the base texture.
            const fx = Math.min(f.x + f.width - 1, Math.max(f.x, Math.floor(f.x + (rx + 0.5) * f.width)));
            const fy = Math.min(f.y + f.height - 1, Math.max(f.y, Math.floor(f.y + (ry + 0.5) * f.height)));
            const fw = Math.max(1, Math.min(Math.ceil(piece.rect.w * f.width), f.x + f.width - fx));
            const fh = Math.max(1, Math.min(Math.ceil(piece.rect.h * f.height), f.y + f.height - fy));
            crop = new PIXI.Texture(texture.baseTexture, new PIXI.Rectangle(fx, fy, fw, fh));
            crops.push(crop);
            sprite = new PIXI.Sprite(crop); sprite.anchor.set(0.5); sprite.width = piece.rect.w * w * flipX; sprite.height = piece.rect.h * h * flipY;
          } else {
            sprite = new PIXI.Sprite(texture); sprite.anchor.set(0.5); sprite.width = w * flipX; sprite.height = h * flipY; sprite.position.set(-cx, -cy);
            const mask = new PIXI.Graphics().beginFill(0xffffff).drawPolygon(piece.polygon.flatMap((p) => [p.x * w - cx, p.y * h - cy])).endFill();
            spin.addChild(mask); sprite.mask = mask;
          }
          if (look.tint !== undefined) sprite.tint = look.tint;
          if (look.greyscale) {
            const filter = stoneFilter(look.greyscale);
            if (filter) { if (!holdsStone) { holdsStone = true; holders++; } sprite.filters = [filter]; }
          }
          spin.addChild(sprite);
          const start = place(cx, cy); box.position.set(start.x, start.y); spin.rotation = turn;
          // Foundry sorts by elevation, sortLayer, sort, then zIndex: match the token so pieces sit with it.
          for (const [key, value] of Object.entries(sorting)) if (value !== undefined) box[key] = value;
          if (mesh.zIndex !== undefined) box.zIndex = mesh.zIndex + 1;
          layer.addChild(box);
          return { box, spin, crop, piece, flight: fragmentFlight(stage, piece, i, cutAngle, turn, size), cx, cy };
        });
      } catch (error) {
        for (const box of boxes) { try { box.destroy({ children: true }); } catch { /* keep cleaning */ } }
        for (const crop of crops) { try { crop.destroy(false); } catch { /* keep cleaning */ } }
        release();
        throw error;
      }
      const shift = () => {
        const now = baseAt(), dx = (now?.x ?? 0) - (base?.x ?? 0), dy = (now?.y ?? 0) - (base?.y ?? 0);
        return pos && Number.isFinite(dx) && Number.isFinite(dy) ? { x: dx, y: dy } : { x: 0, y: 0 };
      };
      return {
        update(p) {
          const moved = shift();
          for (const part of parts) {
            // The flight is already in screen terms: only the piece's own offset turns with the art.
            const pose = fragmentPose(stage, part.piece, part.flight, p), at = place(part.cx, part.cy);
            part.box.position.set(at.x + moved.x + pose.x * g, at.y + moved.y + pose.y * g); part.spin.rotation = turn + (pose.rotation * Math.PI) / 180; part.box.alpha = pose.alpha * look.alpha;
            // The box's origin is the piece's centroid, so it scales and stretches about it, mask included, along screen axes.
            part.box.scale?.set(pose.scale * pose.stretchX, pose.scale * pose.stretchY);
          }
        },
        // Each part on its own: one failure must not leak the rest.
        destroy() {
          for (const part of parts) {
            try { part.box.destroy({ children: true }); } catch { /* keep cleaning */ }
            try { part.crop?.destroy(false); } catch { /* keep cleaning */ }
          }
          release();
        },
      };
    },
  };
}
