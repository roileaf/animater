// Paints thin ice breaking on the map: cracks as ink-outlined lines in the squares that cracked, the sheet itself in plates
// where it gave way, and slush round what a fire melted. Painted, never a glow, and never shaded as if it were lit: a plate is
// a flat pale face with an ink outline and one band of its own colder colour below it, which is the ice's thickness seen from
// straight above — the way a photograph of a broken river reads, and the way this map is painted. The shapes come from
// iceBreakOf (ice-break-look.mjs), the same on every client; only this file touches PIXI. The hole's own ripples are the water
// engine's (the hole is one of its specs); here the ice rides that water, lifting and swinging by the shared clock.
import { shardAt, plateAt } from "./ice-break-look.mjs";

const INK = 0x1b1410, FROST = 0xdcecf2, SHARD = 0xe9f4f7, SHARD_EDGE = 0x5d7f8c;
// A plate seen from above: a pale face, and under it the cold edge of the ice's own thickness, offset a little so the band
// shows on the two sides away from the light. Thickness is a fraction of a square, so a plate reads the same on any map.
const PLATE_FACE = 0xeaf2f4, PLATE_SIDE = 0x79b9ce, PLATE_DEEP = 0x3f7d95;
// The water in the hole, painted here under the plates rather than left to the moving water alone. The hole is a water spec
// too, so the engine's ripples run over this where the screen's quality allows them — but a creature standing in open water
// has to read as standing in open water on every screen, at every quality, and on a map whose own light is warm enough to
// turn pale ice sandy. So the hole is painted: deep water, a darker lip inside its edge where the ice shelves off.
const WATER_DEEP = 0x17465e, WATER_RIM = 0x0b2332;
const PLATE_THICK = 0.05, PLATE_LEAN_X = 0.45, PLATE_LEAN_Y = 0.75;

/** createIceBreakLook({ PIXI, layer, grid }): `layer()` gives the container to draw in (under the creatures), `grid()` the
 *  square size in pixels. sync({ cracks: [{ id, lines }], shards: [{ id, list }] }) draws exactly that, and nothing when
 *  empty; the same state again redraws nothing. While `busy` (shards are floating) tick(ms) moves them, `ms` the shared
 *  clock (the server's time), so every screen shows them at the same point of their drift. */
export function createIceBreakLook({ PIXI, layer, grid = () => 100 }) {
  let waterArt = null, cracksArt = null, shardsArt = null, platesArt = null, shown = "", afloat = [], adrift = [], wet = [], clock = 0;
  const ensure = () => {
    const root = layer?.();
    if (!root) return false;
    if (!waterArt || waterArt.destroyed || !cracksArt || cracksArt.destroyed || !shardsArt || shardsArt.destroyed || !platesArt || platesArt.destroyed) { waterArt = new PIXI.Graphics(); cracksArt = new PIXI.Graphics(); platesArt = new PIXI.Graphics(); shardsArt = new PIXI.Graphics(); shown = ""; } // made in the order they are stacked: cracks under the ice, the plates over them, the slush over those
    if (waterArt.parent !== root) { root.addChild(waterArt); root.addChild(cracksArt); root.addChild(platesArt); root.addChild(shardsArt); }
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
  // The open water a break left: the hole's own ring, filled dark, with a darker lip just inside it.
  const drawWater = () => {
    waterArt.clear();
    for (const hole of wet) {
      const flat = hole?.areas?.[0];
      if (!Array.isArray(flat) || flat.length < 6) continue;
      waterArt.lineStyle(0).beginFill(WATER_DEEP, 0.96).drawPolygon(flat).endFill();
      waterArt.lineStyle(Math.max(2, (grid() || 100) * 0.04), WATER_RIM, 0.75).drawPolygon(flat);
    }
  };
  // The plates of a sheet that gave way: each one its thickness first, then its flat face over it, then the ink outline.
  const drawPlates = () => {
    const g = grid() || 100, k = g / 100, seconds = clock / 1000, thick = g * PLATE_THICK;
    platesArt.clear();
    for (const plate of adrift) {
      const pts = plate.points;
      if (!pts || pts.length < 3) continue;
      const ride = plateAt(plate, seconds), cos = Math.cos(ride.turn), sin = Math.sin(ride.turn);
      // Where each corner is now: swung a little about the plate's middle and lifted a little on the water.
      const flat = [];
      for (const pt of pts) {
        const dx = pt.x - plate.mid.x, dy = pt.y - plate.mid.y;
        flat.push(plate.mid.x + dx * cos - dy * sin + ride.dx, plate.mid.y + dx * sin + dy * cos + ride.dy);
      }
      const under = flat.map((v, i) => v + (i % 2 ? thick * PLATE_LEAN_Y : thick * PLATE_LEAN_X));
      platesArt.lineStyle(0).beginFill(PLATE_DEEP, 0.95).drawPolygon(under).endFill();
      platesArt.lineStyle(0).beginFill(PLATE_SIDE, 0.95).drawPolygon(under.map((v, i) => v - (i % 2 ? thick * 0.3 : thick * 0.18))).endFill();
      platesArt.lineStyle(1.4 * k, INK, 0.7).beginFill(PLATE_FACE, 0.97).drawPolygon(flat).endFill();
    }
  };
  return {
    get busy() { return afloat.length > 0 || adrift.length > 0; },
    sync({ cracks = [], shards = [], plates = [], holes = [] } = {}) {
      const key = JSON.stringify([cracks.map((c) => c.lines), shards.map((s) => s.list), plates.map((p) => p.list), holes.map((h) => h.areas), grid()]);
      // What was drawn last time is only still on screen while its Graphics is: a scene switch destroys it with the map it
      // belonged to, and the same state again must then draw it afresh rather than being waved through as already drawn.
      const gone = !!cracksArt && (cracksArt.destroyed || !shardsArt || shardsArt.destroyed || !platesArt || platesArt.destroyed || !waterArt || waterArt.destroyed || cracksArt.parent !== layer?.());
      if (key === shown && !gone) return;
      afloat = shards.flatMap((s) => s.list);
      adrift = plates.flatMap((p) => p.list);
      wet = holes;
      // (Nothing to draw and nothing drawn yet: no layer is made for a map with no thin ice.)
      if (!cracks.length && !afloat.length && !adrift.length && !wet.length && (!cracksArt || cracksArt.destroyed)) { shown = key; return; }
      if (!ensure()) return;
      shown = key;
      drawWater();
      drawCracks(cracks);
      drawPlates();
      drawShards();
    },
    tick(ms) {
      clock = Number(ms) || 0;
      if (afloat.length && shardsArt && !shardsArt.destroyed) drawShards();
      if (adrift.length && platesArt && !platesArt.destroyed) drawPlates();
    },
    clear() { afloat = []; adrift = []; wet = []; shown = ""; if (cracksArt && !cracksArt.destroyed) { waterArt?.clear(); cracksArt.clear(); platesArt?.clear(); shardsArt.clear(); } },
  };
}
