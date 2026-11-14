// Paints thin ice breaking on the map: cracks as ink-outlined lines in the squares that cracked, and the loose shards floating
// in a hole. Painted, never a glow: a dark ink line under a paler one, and flat pale shards with an ink edge. The shapes come
// from iceBreakOf (ice-break-look.mjs), the same on every client; only this file touches PIXI. The hole's own ripples are the
// water engine's (the hole is one of its specs); here the shards ride that water, bobbing and turning (shardAt) by the shared clock.
import { shardAt } from "./ice-break-look.mjs";

const INK = 0x1b1410, FROST = 0xdcecf2, SHARD = 0xe9f4f7, SHARD_EDGE = 0x5d7f8c;

/** createIceBreakLook({ PIXI, layer, grid }): `layer()` gives the container to draw in (under the creatures), `grid()` the
 *  square size in pixels. sync({ cracks: [{ id, lines }], shards: [{ id, list }] }) draws exactly that, and nothing when
 *  empty; the same state again redraws nothing. While `busy` (shards are floating) tick(ms) moves them, `ms` the shared
 *  clock (the server's time), so every screen shows them at the same point of their drift. */
export function createIceBreakLook({ PIXI, layer, grid = () => 100 }) {
  let cracksArt = null, shardsArt = null, shown = "", afloat = [], clock = 0;
  const ensure = () => {
    const root = layer?.();
    if (!root) return false;
    if (!cracksArt || cracksArt.destroyed || !shardsArt || shardsArt.destroyed) { cracksArt = new PIXI.Graphics(); shardsArt = new PIXI.Graphics(); shown = ""; }
    if (cracksArt.parent !== root) { root.addChild(cracksArt); root.addChild(shardsArt); }
    return true;
  };
  const drawCracks = (cracks) => {
    const k = (grid() || 100) / 100;
    cracksArt.clear();
    for (const { lines } of cracks) for (const line of lines) {
      if (line.length < 2) continue;
      for (const [width, colour, alpha] of [[3.2 * k, INK, 0.55], [1.5 * k, FROST, 0.9]]) {
        cracksArt.lineStyle(width, colour, alpha, 0.5);
        cracksArt.moveTo(line[0].x, line[0].y);
        for (let i = 1; i < line.length; i++) cracksArt.lineTo(line[i].x, line[i].y);
      }
    }
  };
  const drawShards = () => {
    const k = (grid() || 100) / 100, seconds = clock / 1000;
    shardsArt.clear();
    for (const shard of afloat) {
      const s = { ...shard, ...shardAt(shard, seconds) };
      // A broken-off chip: four corners, the long way across the way it is turned.
      const pts = [[1.25, 0], [0.1, 0.8], [-1.1, 0.15], [-0.2, -0.75]].flatMap(([a, b]) => [s.x + (a * Math.cos(s.turn) - b * Math.sin(s.turn)) * s.r, s.y + (a * Math.sin(s.turn) + b * Math.cos(s.turn)) * s.r]);
      shardsArt.lineStyle(1.2 * k, INK, 0.6).beginFill(SHARD, 0.92).drawPolygon(pts).endFill();
      shardsArt.lineStyle(0.6 * k, SHARD_EDGE, 0.7).moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]);
    }
  };
  return {
    get busy() { return afloat.length > 0; },
    sync({ cracks = [], shards = [] } = {}) {
      const key = JSON.stringify([cracks.map((c) => c.lines), shards.map((s) => s.list), grid()]);
      if (key === shown) return;
      afloat = shards.flatMap((s) => s.list);
      // (Nothing to draw and nothing drawn yet: no layer is made for a map with no thin ice.)
      if (!cracks.length && !afloat.length && (!cracksArt || cracksArt.destroyed)) { shown = key; return; }
      if (!ensure()) return;
      shown = key;
      drawCracks(cracks);
      drawShards();
    },
    tick(ms) {
      clock = Number(ms) || 0;
      if (afloat.length && shardsArt && !shardsArt.destroyed) drawShards();
    },
    clear() { afloat = []; shown = ""; if (cracksArt && !cracksArt.destroyed) { cracksArt.clear(); shardsArt.clear(); } },
  };
}
