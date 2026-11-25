// The shadow of something flying over (flyover.mjs), drawn: the creature's own art laid flat and dark, its sides pulled
// out and beaten as wings, or one of the drawn shapes; soft, and laid on the map as shade.

import { shapePolygons, spreadColumn, artTurn } from './flyover.mjs';

const INK = 0x080a16;
// How finely a creature's art is cut to pull its wings out: this many columns each way.
const CUTS = 32;

/**
 * The layer. show(id, { texture }) makes a shadow (from that art, else drawn as a shape each frame);
 * pose(id, { x, y, call, look, beat, wide, grid, zoom, t, gone }) puts it where the flyover is now; drop(id); clear().
 * `wide`: how wide the creature's art is drawn on the map at its true size, in pixels.
 */
export function createFlyoverLayer({ PIXI, root }) {
  const live = new Map();
  const drop = (id) => { const s = live.get(id); if (!s) return; live.delete(id); try { s.holder.parent?.removeChild(s.holder); s.holder.destroy({ children: true }); } catch { /* gone with the canvas */ } };
  return {
    show(id, { texture = null } = {}) {
      drop(id);
      const holder = new PIXI.Container(); holder.eventMode = 'none';
      const s = { holder, plane: null, drawn: null, base: null, blur: null };
      if (texture?.valid && PIXI.SimplePlane) {
        // The art cut into a grid, so its columns (or its rows, for art drawn facing sideways) can be moved apart.
        s.plane = new PIXI.SimplePlane(texture, CUTS + 1, CUTS + 1); s.plane.tint = INK;
        s.base = Float32Array.from(s.plane.geometry.getBuffer('aVertexPosition').data);
        s.size = { w: texture.width, h: texture.height };
        s.plane.pivot.set(texture.width / 2, texture.height / 2);
        holder.addChild(s.plane);
      } else { s.drawn = new PIXI.Graphics(); holder.addChild(s.drawn); }
      // (Looked up here, not when the layer is made: the module loads before there is a PIXI to ask.)
      const Blur = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
      if (Blur) { s.blur = new Blur(4); s.blur.blendMode = PIXI.BLEND_MODES?.MULTIPLY ?? 2; holder.filters = [s.blur]; }
      root().addChild(holder);
      live.set(id, s);
      return true;
    },
    pose(id, { x, y, call, heading = 0, look, beat = 0, wide = 300, grid = 100, zoom = 1, t = 0, gone = 0 }) {
      const s = live.get(id); if (!s) return;
      const off = look.offset * grid;
      s.holder.position.set(x + off, y + off * 0.7);
      s.holder.alpha = look.alpha * (1 - Math.min(1, Math.max(0, gone)));
      if (s.blur) { s.blur.blur = Math.max(1, look.blur * grid * zoom); s.blur.padding = look.blur * grid * zoom * 3 + 8; }
      if (s.plane) {
        // Turned to head the way it flies, drawn `wide` across at its true size, bigger aloft.
        const size = Math.max(s.size.w, s.size.h), k = (wide * look.scale) / size, sideways = call.faces === 'left' || call.faces === 'right';
        s.plane.rotation = artTurn({ angle: heading, faces: call.faces }); s.plane.scale.set(k);
        const buffer = s.plane.geometry.getBuffer('aVertexPosition'), v = buffer.data, across = sideways ? 1 : 0, along = 1 - across, span = sideways ? s.size.h : s.size.w, length = sideways ? s.size.w : s.size.h;
        // (Art drawn facing down or left has its length running the other way: the sweep is turned with it.)
        const toward = call.faces === 'down' || call.faces === 'right' ? 1 : -1;
        for (let i = 0; i < v.length; i += 2) {
          if (!call.spread || look.fold >= 1) { v[i] = s.base[i]; v[i + 1] = s.base[i + 1]; continue; }
          const u = (s.base[i + across] / span - 0.5) * 2, col = spreadColumn(u, { beat, fold: look.fold });
          v[i + across] = (col.at / 2 + 0.5) * span; v[i + along] = s.base[i + along] + col.sweep * length * toward;
        }
        buffer.update();
      } else {
        const g = s.drawn, wings = call.shape !== 'wingless' && call.spread, span = wings ? 1 - 0.28 * (0.5 - 0.5 * beat) - 0.2 * look.fold : 1, body = wide * look.scale * 0.4;
        g.clear(); g.beginFill(INK, 1);
        for (const poly of shapePolygons(call.shape, span, t)) g.drawPolygon(poly.map((n) => n * body));
        g.endFill(); g.rotation = heading;
      }
    },
    drop,
    clear() { for (const id of [...live.keys()]) drop(id); },
    get count() { return live.size; },
  };
}
