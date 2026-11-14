// Paints thin ice breaking on the map: cracks as ink-outlined lines in the squares that cracked, and the loose shards floating
// in a hole. Painted, never a glow: a dark ink line under a paler one, and flat pale shards with an ink edge. The shapes come
// from iceBreakOf (ice-break-look.mjs), the same on every client; only this file touches PIXI.

const INK = 0x1b1410, FROST = 0xdcecf2, SHARD = 0xe9f4f7, SHARD_EDGE = 0x5d7f8c;

/** createIceBreakLook({ PIXI, layer, grid }): `layer()` gives the container to draw in (under the creatures), `grid()` the
 *  square size in pixels. sync({ cracks: [{ id, lines }], shards: [{ id, list }] }) draws exactly that, and nothing when
 *  empty. The same state again redraws nothing. */
export function createIceBreakLook({ PIXI, layer, grid = () => 100 }) {
  let art = null, shown = "";
  const ensure = () => {
    const root = layer?.();
    if (!root) return null;
    if (!art || art.destroyed) { art = new PIXI.Graphics(); shown = ""; }
    if (art.parent !== root) root.addChild(art);
    return art;
  };
  return {
    sync({ cracks = [], shards = [] } = {}) {
      const key = JSON.stringify([cracks.map((c) => c.lines), shards.map((s) => s.list), grid()]);
      if (key === shown) return;
      // (Nothing to draw and nothing drawn yet: no layer is made for a map with no thin ice.)
      if (!cracks.length && !shards.length && (!art || art.destroyed)) { shown = key; return; }
      const g = ensure();
      if (!g) return;
      shown = key;
      g.clear();
      const k = (grid() || 100) / 100;
      for (const { lines } of cracks) for (const line of lines) {
        if (line.length < 2) continue;
        for (const [width, colour, alpha] of [[3.2 * k, INK, 0.55], [1.5 * k, FROST, 0.9]]) {
          g.lineStyle(width, colour, alpha, 0.5);
          g.moveTo(line[0].x, line[0].y);
          for (let i = 1; i < line.length; i++) g.lineTo(line[i].x, line[i].y);
        }
      }
      for (const { list } of shards) for (const s of list) {
        // A broken-off chip: four corners, the long way across the way it is turned.
        const pts = [[1.25, 0], [0.1, 0.8], [-1.1, 0.15], [-0.2, -0.75]].flatMap(([a, b]) => [s.x + (a * Math.cos(s.turn) - b * Math.sin(s.turn)) * s.r, s.y + (a * Math.sin(s.turn) + b * Math.cos(s.turn)) * s.r]);
        g.lineStyle(1.2 * k, INK, 0.6).beginFill(SHARD, 0.92).drawPolygon(pts).endFill();
        g.lineStyle(0.6 * k, SHARD_EDGE, 0.7).moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]);
      }
    },
    clear() { if (art && !art.destroyed) art.clear(); shown = ""; },
  };
}
