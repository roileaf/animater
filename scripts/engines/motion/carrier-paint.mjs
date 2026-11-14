// The carriers painted: a wagon, a covered wagon, a hand cart and a sled, drawn in the same hand as the map's
// decorations (decor-paint.mjs) and with the same tools — hand-inked outline, muted earth, lit from the top left.
//
// Painted, not baked. The carriers used to be a 3D shape raymarched once into a fixed cell and stretched to whatever
// size the map wanted, so they were already soft before anyone zoomed in; Roi, on a wagon at full zoom: "zooming in
// its SUPER low quality", and "take a look at the design system we used for the decorations ... everything should
// have the same design system". A painted picture is drawn at the size it is asked for, so it is as crisp at four
// times in as it is on the table.
//
// Every picture faces up the canvas (the way the thing is going is -y), as the baked ones did, so the module turns
// them the same way. Pure canvas 2D: no Foundry, no PIXI.

import { PAINT_KIT, seeded } from './decor-paint.mjs';

const { painted, inked, softShadow, boxAt, line, trace, poly, woodEnd, pick, shade, INKD, defaultCanvas } = PAINT_KIT;

// Wood and iron, as the maps paint them: the decorations' own planks and ironwork, so a wagon standing among crates
// and timbers belongs to them.
const PLANK = ['#8a6038', '#7a5430', '#96693c'];
const RAIL = '#6e4a2a';
const IRON = '#4a4844';
const CANVAS_CLOTH = ['#c8bb9a', '#bfb08c', '#d2c6a8'];

// Each carrier: how much ground its picture holds along its length, in feet (the shafts included, which is what the
// baked ones kept cropping off), and the bed's own feet, which is what stands on the token.
// The span is twice the furthest thing from the bed's middle, because the bed is what sits on the token and the
// picture is drawn about it: a wagon's shafts reach ten feet forward, so its picture holds twenty feet of ground.
export const PAINTED_CARRIERS = Object.freeze({
  wagon: Object.freeze({ label: 'Open wagon', span: 20, bed: 10, wide: 6 }),
  tilt: Object.freeze({ label: 'Covered wagon', span: 20, bed: 10, wide: 6 }),
  cart: Object.freeze({ label: 'Hand cart', span: 14, bed: 5, wide: 4 }),
  sled: Object.freeze({ label: 'Sled', span: 11, bed: 6, wide: 3.5 }),
});
export const PAINTED_SETS = Object.freeze(Object.keys(PAINTED_CARRIERS));
/** How much ground a painted carrier's picture holds along its length, in feet. */
export const spanOf = (set) => PAINTED_CARRIERS[set]?.span ?? 0;

// A wheel seen from straight above: the tread, a hub, and the rim's iron tyre. Nothing of the spokes shows from here,
// so the tread is what says it is a wheel — and what shifts as it rolls.
function wheel(g, rng, cx, cy, long, wide, o, roll = 0) {
  const body = boxAt(cx, cy, wide, long, 0);
  softShadow(g, body, o, 0.45);
  painted(g, rng, body, '#3f3b36', o, { sharp: true, band: 0.5, lit: 0.08, ink: 1.6 });
  // The tread: bars across the rim, carried round as it rolls.
  const step = long / 5;
  for (let i = -5; i <= 5; i++) {
    const y = cy + ((i * step + roll * step * 2) % (long * 2)) - 0;
    if (y < cy - long || y > cy + long) continue;
    line(g, [[cx - wide, y], [cx + wide, y]], 'rgba(18,12,4,0.5)', Math.max(0.6, o.ink * 0.9));
  }
  // The iron tyre down its outer edge, and the hub cap at its middle.
  line(g, [[cx, cy - long], [cx, cy + long]], 'rgba(255,235,200,0.12)', Math.max(0.8, o.ink * 1.2));
  g.beginPath(); g.arc(cx, cy, Math.max(1, wide * 0.8), 0, 6.283);
  g.fillStyle = IRON; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke();
}

// The bed: planks along its length in an ironbound frame, with rails down its sides.
function bed(g, rng, half, wideHalf, o) {
  const box = boxAt(0, 0, wideHalf, half, 0);
  softShadow(g, box, o, 0.5);
  painted(g, rng, box, pick(rng, PLANK), o, { sharp: true, grain: Math.PI / 2, lines: 7, hatch: 0.45, band: 0.4, lit: 0.08, ink: 1.6 });
  // The boards, each one taking the light on its own.
  for (let i = -4; i <= 4; i++) {
    const x = (i / 4.6) * wideHalf;
    line(g, [[x, -half * 0.97], [x, half * 0.97]], 'rgba(26,14,4,0.55)', Math.max(0.6, o.ink * 0.8));
    line(g, [[x - 0.7, -half * 0.97], [x - 0.7, half * 0.97]], 'rgba(255,230,190,0.13)', Math.max(0.6, o.ink * 0.6));
  }
  // The side rails and the boards that end them.
  for (const side of [-1, 1]) painted(g, rng, boxAt(side * wideHalf, 0, wideHalf * 0.09, half, 0), RAIL, o, { sharp: true, band: 0.45, lit: 0.12, ink: 1.5 });
  for (const end of [-1, 1]) painted(g, rng, boxAt(0, end * half, wideHalf, half * 0.07, 0), RAIL, o, { sharp: true, band: 0.45, lit: 0.12, ink: 1.5 });
  // The iron bands at its corners.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) painted(g, rng, boxAt(sx * wideHalf, sy * half * 0.92, wideHalf * 0.1, half * 0.07, 0), IRON, o, { sharp: true, band: 0.35, lit: 0.2, ink: 1.4 });
  return box;
}

// The shafts reaching forward to whatever pulls it, and the swingletree across their tips.
// Two shafts reaching forward with the gap a horse stands in between them, splayed a little as real ones are, and a
// swingletree across their tips for the traces. Thin: a shaft is a pole, and drawn heavy the pair read as one handle.
function shafts(g, rng, from, to, apart, o) {
  const reach = Math.abs(to - from);
  for (const side of [-1, 1]) {
    const pts = [[side * apart * 0.8, from], [side * apart * 0.95, from - (to > from ? -reach : reach) * 0.45], [side * apart, to]];
    line(g, pts, INKD, Math.max(1.2, o.ink * 2.4));
    line(g, pts, '#7e5a34', Math.max(0.8, o.ink * 1.3));
    line(g, pts.map(([x, y]) => [x - 0.6, y - 0.6]), 'rgba(255,235,200,0.2)', Math.max(0.5, o.ink * 0.7));
  }
  const bar = boxAt(0, to + (to < from ? reach * 0.06 : -reach * 0.06), apart * 1.05, reach * 0.018 + 1, 0);
  line(g, [[-apart * 1.05, bar[0][1]], [apart * 1.05, bar[0][1]]], INKD, Math.max(1.2, o.ink * 2.6));
  line(g, [[-apart * 1.05, bar[0][1]], [apart * 1.05, bar[0][1]]], '#6e4a2a', Math.max(0.9, o.ink * 1.5));
}

const PAINTERS = {
  // An open wagon: a ten-foot bed, four wheels four and a half feet across standing clear of it, and the shafts
  // reaching five feet out in front. Everything is laid out in feet against the picture's own span, so the parts are
  // the sizes they would really be rather than fractions that looked about right.
  wagon(g, s, rng, o) {
    const ft = (n) => (n / (PAINTED_CARRIERS.wagon.span / 2)) * s;
    // The wheels stand clear of the bed, not tucked under its edge, or from above there is nothing of them to see.
    const half = ft(5), wideHalf = ft(2.7), wheelLong = ft(2.3), wheelWide = ft(0.22), out = ft(3.3);
    for (const sy of [-1, 1]) for (const sx of [-1, 1]) wheel(g, rng, sx * out, sy * ft(3.2), wheelLong, wheelWide, o, o.roll ?? 0);
    // The axles the wheels turn on, under the bed and out past it.
    for (const sy of [-1, 1]) painted(g, rng, boxAt(0, sy * ft(3.2), out, ft(0.18), 0), IRON, o, { sharp: true, band: 0.35, lit: 0.2, ink: 1.3 });
    const box = bed(g, rng, half, wideHalf, o);
    shafts(g, rng, -half, -ft(10), wideHalf * 0.55, o);
    return [box];
  },
  // The same wagon under canvas: a tilt bellied on its hoops, pale and worn, the hoops showing through it.
  tilt(g, s, rng, o) {
    const out = PAINTERS.wagon(g, s, rng, o);
    const ft = (n) => (n / (PAINTED_CARRIERS.tilt.span / 2)) * s;
    const half = ft(5), wideHalf = ft(2.7);
    const shell = [];
    for (let i = 0; i <= 26; i++) { const t = i / 26; shell.push([-wideHalf * 1.02, -half * 0.98 + t * half * 1.96]); }
    for (let i = 26; i >= 0; i--) { const t = i / 26; shell.push([wideHalf * 1.02, -half * 0.98 + t * half * 1.96]); }
    painted(g, rng, shell, pick(rng, CANVAS_CLOTH), o, { sharp: true, band: 0.3, lit: 0.18, ink: 1.5 });
    // The hoops under it, and the seam down the ridge.
    for (let i = -2; i <= 2; i++) { const y = (i / 2.4) * half; line(g, [[-wideHalf * 1.02, y], [wideHalf * 1.02, y]], 'rgba(40,28,12,0.3)', Math.max(0.7, o.ink * 1.1)); }
    line(g, [[0, -half * 0.98], [0, half * 0.98]], 'rgba(255,250,235,0.22)', Math.max(0.8, o.ink * 1.4));
    line(g, [[wideHalf * 0.42, -half * 0.98], [wideHalf * 0.42, half * 0.98]], 'rgba(30,20,8,0.16)', Math.max(0.6, o.ink * 0.9));
    return out;
  },
  // A hand cart: one axle under a five-foot bed, and the shafts a person stands between.
  cart(g, s, rng, o) {
    const ft = (n) => (n / (PAINTED_CARRIERS.cart.span / 2)) * s;
    const half = ft(2.5), wideHalf = ft(2), wheelLong = ft(1.8), wheelWide = ft(0.18), out = ft(2.4);
    for (const sx of [-1, 1]) wheel(g, rng, sx * out, 0, wheelLong, wheelWide, o, o.roll ?? 0);
    painted(g, rng, boxAt(0, 0, out, ft(0.16), 0), IRON, o, { sharp: true, band: 0.35, lit: 0.2, ink: 1.3 });
    const box = bed(g, rng, half, wideHalf, o);
    shafts(g, rng, -half, -ft(7), wideHalf * 0.5, o);
    return [box];
  },
  // A sled: two long runners under a plank deck, a rope at its nose.
  sled(g, s, rng, o) {
    const ft = (n) => (n / (PAINTED_CARRIERS.sled.span / 2)) * s;
    const half = ft(3), wideHalf = ft(1.75);
    for (const side of [-1, 1]) {
      const runner = boxAt(side * wideHalf * 0.92, 0, wideHalf * 0.1, half, 0);
      softShadow(g, runner, o, 0.4);
      painted(g, rng, runner, '#5a4632', o, { sharp: true, band: 0.45, lit: 0.1, ink: 1.6 });
      line(g, [[side * wideHalf * 0.92, -half], [side * wideHalf * 0.92, half]], 'rgba(220,235,245,0.3)', Math.max(0.8, o.ink * 1.2));
    }
    const deck = boxAt(0, half * 0.05, wideHalf * 0.84, half * 0.78, 0);
    painted(g, rng, deck, pick(rng, PLANK), o, { sharp: true, grain: 0, lines: 6, hatch: 0.45, band: 0.4, lit: 0.08, ink: 1.6 });
    for (let i = -3; i <= 3; i++) { const y = half * 0.05 + (i / 3.4) * half * 0.78; line(g, [[-wideHalf * 0.84, y], [wideHalf * 0.84, y]], 'rgba(26,14,4,0.5)', Math.max(0.6, o.ink * 0.8)); }
    // The curl of the runners at the nose. The sled used to carry a painted bridle here, a V meeting at a point
    // ahead of it, from when nothing pulled it; now that its pack is drawn, the traces are run from the deck's own
    // front corners to each animal (main.mjs paintCarrierRope), so a painted one would only double the line.
    for (const side of [-1, 1]) { g.beginPath(); g.arc(side * wideHalf * 0.92, -half, wideHalf * 0.1, 0, 3.1416, true); g.strokeStyle = INKD; g.lineWidth = Math.max(1.4, o.ink * 3); g.stroke(); g.strokeStyle = '#6a5440'; g.lineWidth = Math.max(1, o.ink * 1.8); g.stroke(); }
    return [deck];
  },
};

/**
 * One carrier painted into a canvas of its own: `{ canvas, shadow, width, height }`, the picture facing up and the
 * thing drawn to fill `px` along its length. `roll` (0 to 1) carries the tread round as it rolls. The shadow canvas is
 * its silhouette, for whatever lays its shadow.
 */
export function paintCarrier(set, seed = 1, px = 200, look = {}, make = defaultCanvas) {
  const kind = PAINTERS[set];
  if (!kind) return null;
  const size = Math.max(16, Math.ceil(px)), pad = Math.ceil(size * 0.06), w = size + pad * 2;
  const canvas = make(w, w), g = canvas.getContext('2d'), rng = seeded(seed);
  const unit = size / (PAINTED_CARRIERS[set].span / 5);
  const o = { snow: 0, wet: 0, night: false, ...look, unit, ink: Math.max(1, unit / 60) };
  g.translate(w / 2, w / 2);
  const outlines = kind(g, size / 2, rng, o) ?? [];
  const shadow = make(w, w), s = shadow.getContext('2d');
  s.translate(w / 2, w / 2); s.fillStyle = '#fff'; s.strokeStyle = '#fff'; s.lineJoin = 'round'; s.lineCap = 'round';
  for (const pts of outlines) { trace(s, pts); s.fill(); s.lineWidth = o.ink * 2; s.stroke(); }
  return { canvas, shadow, width: w, height: w };
}
