// Paints thin ice breaking on the map: cracks as ink-outlined lines in the squares that cracked, the sheet itself in plates
// where it gave way, and slush round what a fire melted. Painted, never a glow, and never shaded as if it were lit: a plate is
// a flat pale face with an ink outline and one band of its own colder colour below it, which is the ice's thickness seen from
// straight above — the way a photograph of a broken river reads, and the way this map is painted. The shapes come from
// iceBreakOf (ice-break-look.mjs), the same on every client; only this file touches PIXI. The hole's own ripples are the water
// engine's (the hole is one of its specs); here the ice rides that water, lifting and swinging by the shared clock.
import { shardAt, plateAt } from "./ice-break-look.mjs";

const INK = 0x1b1410, FROST = 0xdcecf2, SHARD = 0xe9f4f7, SHARD_EDGE = 0x5d7f8c;
// A plate of ice seen from above. Ice is not a tile: it is see-through, so the dark water under it shows through and
// colours it, and what catches the light is the broken edge rather than the whole face.
//
// The colours are frankly blue rather than the white ice is in the hand. A map lit warm — a desert, a torch, a sunset —
// multiplies this whole layer by its own light, and a near-white face comes out of that as sand-coloured card. Ice that
// is blue to begin with comes out of it as pale ice. The cost is that on a cold blue map it is a little bluer than life,
// which is the right way round: ice reads as ice either way, and card never does.
const PLATE_FACE = 0x9ecfe8, PLATE_FACE_ALPHA = 0.72;
const PLATE_SIDE = 0x6fb4d2, PLATE_DEEP = 0x245a74;
// The lit broken edge, the line where ice meets water, and the flaws frozen into the sheet.
const PLATE_RIM = 0xdff5ff, PLATE_EDGE = 0x1d4257, PLATE_FLAW = 0x76a8c0;
// Where the light comes from, as a direction on the map. Only the edges that face it catch the bright line; a rim drawn
// all the way round a slab is a border, and a border is what paper has.
const LIGHT_X = -0.6, LIGHT_Y = -0.8;
// How much paler one slab can be than another: the dry ones against the ones that tipped and came up wet.
const PLATE_TONE = 0.16;
// The water in the hole, painted into a layer of its own BELOW the moving water rather than with the ice above it. The hole
// is a water spec too, and the engine draws clear water: over a desert map you could see the sand through the hole. This is
// the dark it has no bed for, so the engine's ripples run over deep water instead of over the ground, and on a screen with
// no moving water at all it is the water. A darker lip inside its edge marks where the ice shelves off.
const WATER_DEEP = 0x17465e, WATER_RIM = 0x0b2332;
// The split itself, and the lip of ice beside it that catches the light.
const CRACK_DARK = 0x14303c, CRACK_LIP = 0xf2fbfd;
// Thickness is a fraction of a square, so a plate reads the same on any map: a thin band past the far edge, not a shadow.
const PLATE_THICK = 0.022, PLATE_LEAN_X = 0.5, PLATE_LEAN_Y = 0.85;

/** createIceBreakLook({ PIXI, layer, grid }): `layer()` gives the container to draw in (under the creatures), `grid()` the
 *  square size in pixels. sync({ cracks: [{ id, lines }], shards: [{ id, list }] }) draws exactly that, and nothing when
 *  empty; the same state again redraws nothing. While `busy` (shards are floating) tick(ms) moves them, `ms` the shared
 *  clock (the server's time), so every screen shows them at the same point of their drift. */
export function createIceBreakLook({ PIXI, layer, bed, grid = () => 100 }) {
  let waterArt = null, cracksArt = null, shardsArt = null, platesArt = null, shown = "", afloat = [], adrift = [], wet = [], clock = 0;
  const ensure = () => {
    const root = layer?.();
    if (!root) return false;
    if (!waterArt || waterArt.destroyed || !cracksArt || cracksArt.destroyed || !shardsArt || shardsArt.destroyed || !platesArt || platesArt.destroyed) { waterArt = new PIXI.Graphics(); cracksArt = new PIXI.Graphics(); platesArt = new PIXI.Graphics(); shardsArt = new PIXI.Graphics(); shown = ""; } // made in the order they are stacked: cracks under the ice, the plates over them, the slush over those
    // The dark water goes in its own container under the moving water; everything else sits above it, over the ice.
    const under = bed?.() ?? root;
    if (waterArt.parent !== under) under.addChild(waterArt);
    if (cracksArt.parent !== root) { root.addChild(cracksArt); root.addChild(platesArt); root.addChild(shardsArt); }
    return true;
  };
  // A crack is a split in the ice, so it is drawn as one: a thin dark fissure, with a paler lip just below and right of it
  // where the ice has lifted. Drawn the other way round — a thick pale line with a dark edge — it read as rope or twigs
  // lying on the surface, which is what it was.
  const drawCracks = (cracks) => {
    const k = (grid() || 100) / 100, lip = Math.max(0.6, 0.9 * k);
    cracksArt.clear();
    const run = (line, dx, dy) => {
      cracksArt.moveTo(line[0].x + dx, line[0].y + dy);
      for (let i = 1; i < line.length; i++) cracksArt.lineTo(line[i].x + dx, line[i].y + dy);
    };
    for (const { lines } of cracks) for (const line of lines) {
      if (line.length < 2) continue;
      cracksArt.lineStyle(Math.max(1, 0.9 * k), CRACK_LIP, 0.5, 0.5);
      run(line, lip, lip);
      cracksArt.lineStyle(Math.max(1, 1.1 * k), CRACK_DARK, 0.85, 0.5);
      run(line, 0, 0);
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
    const g = grid() || 100, k = g / 100, seconds = clock / 1000, thick = Math.max(1, g * PLATE_THICK);
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
      // The thickness of the sheet seen past its far edge: a thin band, not a shadow the width of a finger.
      const under = flat.map((v, i) => v + (i % 2 ? thick * PLATE_LEAN_Y : thick * PLATE_LEAN_X));
      platesArt.lineStyle(0).beginFill(PLATE_DEEP, 0.9).drawPolygon(under).endFill();
      platesArt.lineStyle(0).beginFill(PLATE_SIDE, 0.85).drawPolygon(under.map((v, i) => v - (i % 2 ? thick * 0.45 : thick * 0.26))).endFill();
      // The ice itself, see-through, so the water under it does the colouring. This is the whole difference between ice
      // and a tile, and no amount of outlining makes an opaque face read as ice.
      const tone = Number.isFinite(plate.tone) ? plate.tone : 0.5;
      platesArt.lineStyle(0).beginFill(PLATE_FACE, PLATE_FACE_ALPHA * (1 - PLATE_TONE / 2 + tone * PLATE_TONE)).drawPolygon(flat).endFill();
      // The line where the ice meets the water, all the way round.
      platesArt.lineStyle(Math.max(1, 1.1 * k), PLATE_EDGE, 0.7, 0).drawPolygon(flat);
      // And the bright broken edge, on the sides facing the light only.
      platesArt.lineStyle(Math.max(1, 1.3 * k), PLATE_RIM, 0.5, 1);
      for (let i = 0; i < flat.length; i += 2) {
        const ax = flat[i], ay = flat[i + 1], bx = flat[(i + 2) % flat.length], by = flat[(i + 3) % flat.length];
        const ex = bx - ax, ey = by - ay, run = Math.hypot(ex, ey);
        if (!(run > 0)) continue;
        // The outward normal of this edge, for a ring wound either way: take the one pointing away from the middle.
        let nx = ey / run, ny = -ex / run;
        const midX = (ax + bx) / 2 - plate.mid.x, midY = (ay + by) / 2 - plate.mid.y;
        if (nx * midX + ny * midY < 0) { nx = -nx; ny = -ny; }
        if (nx * LIGHT_X + ny * LIGHT_Y <= 0.15) continue;
        platesArt.moveTo(ax, ay);
        platesArt.lineTo(bx, by);
      }
      // A flaw or two frozen into it, drawn between its own corners, so no two plates carry the same ones.
      if (pts.length >= 5) {
        platesArt.lineStyle(Math.max(1, 0.8 * k), PLATE_FLAW, 0.38, 0.5);
        for (let i = 0; i + 3 < pts.length; i += 3) {
          const a = i * 2, b = (i + 2) * 2;
          platesArt.moveTo(flat[a] * 0.78 + plate.mid.x * 0.22, flat[a + 1] * 0.78 + plate.mid.y * 0.22);
          platesArt.lineTo(flat[b] * 0.72 + plate.mid.x * 0.28, flat[b + 1] * 0.72 + plate.mid.y * 0.28);
        }
      }
    }
  };
  return {
    get busy() { return afloat.length > 0 || adrift.length > 0; },
    sync({ cracks = [], shards = [], plates = [], holes = [] } = {}) {
      const key = JSON.stringify([cracks.map((c) => c.lines), shards.map((s) => s.list), plates.map((p) => p.list), holes.map((h) => h.areas), grid()]);
      // What was drawn last time is only still on screen while its Graphics is: a scene switch destroys it with the map it
      // belonged to, and the same state again must then draw it afresh rather than being waved through as already drawn.
      const gone = !!cracksArt && (cracksArt.destroyed || !shardsArt || shardsArt.destroyed || !platesArt || platesArt.destroyed || !waterArt || waterArt.destroyed || cracksArt.parent !== layer?.() || waterArt.parent !== (bed?.() ?? layer?.()));
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
