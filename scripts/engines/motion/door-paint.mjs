// A door's art, painted like the walls it hangs in (wall-paint.mjs, decor-paint.mjs's PAINT_KIT).
//
// Seen from straight above a door is almost all leaf: a slab as thick as the wall, its ironwork crossing it, swung
// out into the room on its hinge. The doorway itself is not drawn at all — it is the gap the stone leaves, and the
// jambs are the stone's own ends. So this paints one thing, the leaf, straight along its own length from its hinge;
// where it hangs and how far it has swung belongs to painted-doors.mjs.
//
// Pure canvas 2D: no Foundry, no PIXI, no clock.

import { PAINT_KIT, seeded } from './decor-paint.mjs';
import { LIGHT, underLight, PICTURE_SHARP } from './wall-paint.mjs';

const { poly, line, shade, noise, INK, defaultCanvas } = PAINT_KIT;

/** How thick a door is drawn, as a share of a grid square: a door fills the wall it hangs in. */
export const DOOR_THICK = 0.3;
/** How far a door stands open, in radians: wide, but never flat against the wall. */
export const DOOR_SWING = Math.PI * 0.46;

const box = (cx, cy, halfLong, halfThick) => [[-halfLong, -halfThick], [halfLong, -halfThick], [halfLong, halfThick], [-halfLong, halfThick]].map(([u, v]) => [cx + u, cy + v]);

/** A flat painted face in the maps' hand: base, soft mottle, fine grain, a lit top edge, a shaded one, an ink line. */
function face(g, rng, pts, base, o, { grain = 0.1, blotch = 4, sharp = true } = {}) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), w = x1 - x0, h = y1 - y0;
  const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  if (sharp) poly(g, pts); else path();
  g.fillStyle = base; g.fill();
  g.save(); if (sharp) poly(g, pts); else path(); g.clip();
  g.filter = `blur(${Math.max(1, h * 0.3)}px)`;
  for (let i = 0; i < blotch; i++) {
    const x = x0 + rng() * w, y = y0 + rng() * h, r = h * (0.4 + rng() * 0.8);
    g.fillStyle = rng() < 0.5 ? `rgba(16,13,10,${0.06 + rng() * 0.08})` : `rgba(240,232,214,${0.04 + rng() * 0.06})`;
    g.beginPath(); g.ellipse(x, y, r, r * 0.6, rng() * 3, 0, 6.283); g.fill();
  }
  g.filter = 'none';
  for (let i = 0; i < Math.min(900, w * h * 0.4); i++) { g.fillStyle = rng() < 0.55 ? `rgba(14,12,9,${grain})` : `rgba(240,235,222,${grain * 0.7})`; g.fillRect(x0 + rng() * w, y0 + rng() * h, 1, 1); }
  g.strokeStyle = 'rgba(244,238,224,0.16)'; g.lineWidth = Math.max(1, h * 0.1);
  g.beginPath(); g.moveTo(x0, y0 + h * 0.06); g.lineTo(x1, y0 + h * 0.06); g.stroke();
  g.strokeStyle = 'rgba(12,10,7,0.3)';
  g.beginPath(); g.moveTo(x0, y1 - h * 0.06); g.lineTo(x1, y1 - h * 0.06); g.stroke();
  g.restore();
  if (sharp) poly(g, pts); else path();
  g.strokeStyle = INK; g.lineWidth = o.ink * 1.3; g.lineJoin = 'round'; g.stroke();
}

/** A joint cut into the leaf: a dark line with a pale lip, as the walls' courses are. */
const groove = (g, pts, o, dark = 0.4) => {
  line(g, pts.map(([x, y]) => [x + LIGHT.at[0] * o.ink * 0.8, y + LIGHT.at[1] * o.ink * 0.8]), 'rgba(242,236,222,0.12)', o.ink * 0.8);
  line(g, pts, `rgba(14,11,8,${dark})`, o.ink * 0.9);
};
/** An iron band across the leaf, with a stud at each end where the door is a strong one. */
const band = (g, at, thick, o, iron, width = 2, studs = false) => {
  const w = Math.max(1.5, o.unit * 0.014 * width), pts = [[at, -thick / 2], [at, thick / 2]];
  line(g, pts.map(([x, y]) => [x + LIGHT.at[0] * o.ink, y + LIGHT.at[1] * o.ink]), 'rgba(236,230,214,0.14)', w);
  line(g, pts, iron, w);
  line(g, pts, 'rgba(12,10,8,0.5)', Math.max(0.6, w * 0.3));
  // The bolt heads at each end of the band, seen from straight above. Iron's own colour with an ink line round it and
  // the faintest catch of light: lit up and drawn as wide as the handle they read as ball bearings, and six of them
  // took the eye before the door did (Roi, on a door zoomed right in: "thoughts?").
  if (studs) for (const y of [-thick * 0.32, thick * 0.32]) {
    g.beginPath(); g.arc(at, y, w * 0.6, 0, 6.283);
    g.fillStyle = iron; g.fill();
    g.strokeStyle = 'rgba(10,8,6,0.7)'; g.lineWidth = o.ink * 0.8; g.stroke();
    g.beginPath(); g.arc(at + LIGHT.at[0] * w * 0.22, y + LIGHT.at[1] * w * 0.22, w * 0.24, 0, 6.283); g.fillStyle = 'rgba(248,242,228,0.18)'; g.fill();
  }
};
// The pull, at the end the door opens from. A handle is mounted on a FACE of the door, and the map looks straight
// down at the door's top edge, so from up here it is not a ring lying on the middle of the leaf — that is the view
// you get standing in front of the door (Roi: "isnt that the handle? were looking at the door from the top..").
// From above it shows as a small dark lump standing out past the leaf's long side, and a door carries one on each
// face, so both are drawn. Small and dark: the wood is the only light thing on a door seen from overhead.
const ring = (g, x, thick, o, iron) => {
  const r = Math.max(1.2, o.unit * 0.035);
  for (const side of [-1, 1]) {
    const y = side * (thick / 2 + r * 0.55);
    g.beginPath(); g.arc(x, y, r, 0, 6.283);
    g.fillStyle = iron; g.fill();
    g.strokeStyle = 'rgba(10,8,6,0.75)'; g.lineWidth = o.ink; g.stroke();
    // The one catch of light on it, from the same corner everything else here is lit from. Faint: iron in the open
    // air reads dark from above, and a bright bead on it looked like a pearl rather than a handle.
    g.beginPath(); g.arc(x + LIGHT.at[0] * r * 0.3, y + LIGHT.at[1] * r * 0.3, r * 0.3, 0, 6.283);
    g.fillStyle = 'rgba(246,240,226,0.2)'; g.fill();
  }
};
// The pins the leaf turns on. The quietest end of the door: it is the end nothing happens at, and drawn heavy it was
// the first thing the eye found.
const hingePins = (g, x, thick, o, iron) => {
  for (const y of [-thick * 0.34, thick * 0.34]) {
    g.beginPath(); g.arc(x, y, Math.max(1, thick * 0.085), 0, 6.283); g.fillStyle = iron; g.fill();
    g.strokeStyle = 'rgba(14,11,8,0.6)'; g.lineWidth = o.ink * 0.8; g.stroke();
  }
};

/**
 * What a door can be. `wall` lists the wall materials it suits, so laying a doorway in a timber wall offers the
 * planked door first rather than making a GM pick it every time.
 */
export const DOOR_KINDS = Object.freeze({
  planks: {
    label: 'Planked', about: 'boards and two iron bands: a room door',
    body: '#6b5538', iron: '#3b3833', wall: ['timber', 'palisade', 'adobe'],
    leaf(g, rng, o, { len, thick }) {
      face(g, rng, box(0, 0, len / 2, thick / 2), this.body, o, { grain: 0.1 });
      for (let i = 1; i < 5; i++) { const x = -len / 2 + (len * i) / 5; groove(g, [[x, -thick / 2], [x, thick / 2]], o, 0.42); }
      for (const at of [-len * 0.26, len * 0.26]) band(g, at, thick, o, this.iron, 2);
      ring(g, len / 2 - o.unit * 0.1, thick, o, this.iron);
      hingePins(g, -(len / 2 - o.unit * 0.05), thick, o, this.iron);
    },
  },
  banded: {
    label: 'Banded oak', about: 'heavy boards, three bands, studs: a strong door',
    body: '#5a452c', iron: '#34322e', wall: ['dressed', 'fieldstone', 'brick'],
    leaf(g, rng, o, { len, thick }) {
      face(g, rng, box(0, 0, len / 2, thick / 2), this.body, o, { grain: 0.12 });
      for (let i = 1; i < 4; i++) { const x = -len / 2 + (len * i) / 4; groove(g, [[x, -thick / 2], [x, thick / 2]], o, 0.5); }
      for (const at of [-len * 0.34, 0, len * 0.34]) band(g, at, thick, o, this.iron, 2, true);
      ring(g, len / 2 - o.unit * 0.12, thick, o, this.iron);
      hingePins(g, -(len / 2 - o.unit * 0.05), thick, o, this.iron);
    },
  },
  slab: {
    label: 'Stone slab', about: 'cut from the same rock, pivoting: a tomb or a vault',
    body: '#6a6860', iron: '#2f2e2a', wall: ['hewn', 'natural'],
    leaf(g, rng, o, { len, thick }) {
      face(g, rng, box(0, 0, len / 2, thick / 2), this.body, o, { grain: 0.12 });
      for (const at of [-len * 0.3, len * 0.3]) groove(g, [[at, -thick / 2], [at, thick / 2]], o, 0.26);
      const inner = box(0, 0, len * 0.34, thick * 0.3);
      poly(g, inner); g.fillStyle = 'rgba(18,16,12,0.22)'; g.fill();
      poly(g, inner); g.strokeStyle = 'rgba(240,234,220,0.1)'; g.lineWidth = o.ink; g.stroke();
    },
  },
  iron: {
    label: 'Iron', about: 'plates and rivets: a cell, a strongroom',
    body: '#4a4a48', iron: '#2b2b29', wall: [],
    leaf(g, rng, o, { len, thick }) {
      face(g, rng, box(0, 0, len / 2, thick / 2), this.body, o, { grain: 0.09 });
      for (const at of [-len * 0.18, len * 0.18]) groove(g, [[at, -thick / 2], [at, thick / 2]], o, 0.4);
      for (let i = 0; i < 10; i++) {
        const x = -len / 2 + (len * (i + 0.5)) / 10;
        // Rivets, read the same way as the bolt heads on a banded door: iron's own colour, inked, barely lit. Pale
        // they were a row of pearls down a grey plate rather than iron hammered into iron.
        for (const y of [-thick * 0.33, thick * 0.33]) {
          g.beginPath(); g.arc(x, y, Math.max(0.9, thick * 0.055), 0, 6.283);
          g.fillStyle = this.iron; g.fill();
          g.strokeStyle = 'rgba(10,8,6,0.6)'; g.lineWidth = o.ink * 0.7; g.stroke();
          g.beginPath(); g.arc(x + LIGHT.at[0] * thick * 0.022, y + LIGHT.at[1] * thick * 0.022, Math.max(0.5, thick * 0.022), 0, 6.283); g.fillStyle = 'rgba(244,238,224,0.16)'; g.fill();
        }
      }
      hingePins(g, -(len / 2 - o.unit * 0.05), thick, o, this.iron);
    },
  },
  grate: {
    label: 'Portcullis', about: 'bars: you see through it, nothing gets past',
    body: '#3f3e3a', iron: '#2a2a27', wall: [],
    leaf(g, rng, o, { len, thick }) {
      // Bars with the floor showing between them, so only the bars are drawn.
      for (let i = 0; i <= 9; i++) {
        const x = -len / 2 + (len * i) / 9, bar = box(x, 0, Math.max(1, thick * 0.1), thick / 2);
        face(g, rng, bar, this.body, o, { grain: 0.07, blotch: 1 });
      }
      for (const y of [-thick * 0.28, thick * 0.28]) face(g, rng, box(0, y, len / 2, Math.max(1, thick * 0.1)), shade(this.body, 0.06), o, { grain: 0.07, blotch: 1 });
    },
  },
  hide: {
    label: 'Hide', about: 'hung, not hinged: a hut, a cave mouth, a tent',
    body: '#6d5a42', iron: '#3a3025', wall: ['natural'],
    leaf(g, rng, o, { len, thick }) {
      // Cloth hangs in folds instead of swinging flat, so its edge wanders and its folds run across it.
      const pts = [];
      for (let i = 0; i <= 22; i++) { const x = -len / 2 + len * (i / 22); pts.push([x, -thick / 2 + (noise(x * 0.06, 3) - 0.5) * thick * 0.5]); }
      for (let i = 22; i >= 0; i--) { const x = -len / 2 + len * (i / 22); pts.push([x, thick / 2 + (noise(x * 0.06, 9) - 0.5) * thick * 0.5]); }
      face(g, rng, pts, this.body, o, { grain: 0.11, sharp: false });
      for (let i = 1; i < 9; i++) { const x = -len / 2 + (len * i) / 9; groove(g, [[x + (noise(x * 0.1, 2) - 0.5) * thick * 0.3, -thick / 2], [x, thick / 2]], o, 0.28); }
    },
  },
});

export const DOOR_IDS = Object.freeze(Object.keys(DOOR_KINDS));
export const DOOR_CHOICES = Object.freeze(Object.entries(DOOR_KINDS).map(([id, d]) => Object.freeze({ id, label: d.label, about: d.about, base: d.body })));

/** The door a wall of this material would have, unless the GM says otherwise. */
export const doorFor = (material) => DOOR_IDS.find((id) => DOOR_KINDS[id].wall.includes(material)) ?? 'banded';

/** A door that hangs rather than swings keeps still when it opens; it is drawn aside instead. */
export const doorHangs = (kind) => kind === 'hide';

/**
 * Where a doorway is cut along a wall (pure). `len` the wall, `at` how far along the GM clicked, `wide` the opening.
 * It is slid to sit wholly inside the wall, and then — the part that matters — slid flush to an end rather than
 * leaving a stub too short to be a wall there. A dropped stub is a hole in the room (Roi: "why is there a whole in
 * the wall it's supposed to be a complete room"), so the stone either side always reaches the corner it is meant to.
 * Returns { from, to, before, after }: the opening, and whether there is wall left on each side of it.
 */
export function doorwaySpan(len, at, wide, least = 2) {
  const span = Math.max(0, Math.min(len, wide));
  const middle = Math.max(span / 2, Math.min(len - span / 2, at));
  let from = middle - span / 2, to = middle + span / 2;
  if (from < least) { to = Math.min(len, to - from); from = 0; }
  if (len - to < least) { from = Math.max(0, from - (to - len)); to = len; }
  return { from, to, before: from > least, after: len - to > least };
}

/**
 * One leaf, painted straight, its hinge at the left-hand end of the picture and its length running right. The
 * picture has room round it for its own shadow. Returns { canvas, hinge: [x, y], length, thick }.
 */
export function paintDoorLeaf(kind, length, look = {}, make = defaultCanvas) { return underLight(look?.lit, () => paintDoorLeafLit(kind, length, look, make)); }
function paintDoorLeafLit(kind, length, look = {}, make = defaultCanvas) {
  const d = DOOR_KINDS[kind] ?? DOOR_KINDS.banded;
  const unit = look.grid ?? 100, len = Math.max(8, length), thick = unit * (look.thick ?? DOOR_THICK);
  const pad = Math.ceil(Math.max(thick, unit * 0.14));
  const w = Math.ceil(len + pad * 2), h = Math.ceil(thick + pad * 2);
  // More picture pixels than the leaf covers on the map, so it is still a door when the table leans in. The
  // caller is handed the size it asked for; the sharpness is inside the picture, not in what it measures.
  const k = Math.max(1, Number(look.sharp) || PICTURE_SHARP);
  const canvas = make(Math.ceil(w * k), Math.ceil(h * k)), g = canvas.getContext('2d');
  if (!g) return null;
  const o = { unit, ink: Math.max(0.7, unit / 90) }, rng = seeded(look.seed ?? 3);
  g.scale(k, k);
  g.translate(pad + len / 2, pad + thick / 2);
  // Its own shadow on the floor, thrown away from the light; it swings with the leaf, because it is the leaf's.
  g.save(); g.filter = `blur(${Math.max(2, unit * 0.05)}px)`; g.translate(-LIGHT.at[0] * unit * 0.16, -LIGHT.at[1] * unit * 0.16);
  poly(g, box(0, 0, len / 2, thick / 2)); g.fillStyle = 'rgba(10,8,5,0.38)'; g.fill(); g.restore();
  d.leaf(g, rng, o, { len, thick });
  // `box` is the size this picture covers on the map, which is not the size of the canvas any more: the canvas
  // holds more pixels than that so it keeps its edges when the table zooms in. Whoever shows it wants the box.
  return { canvas, hinge: [pad, pad + thick / 2], length: len, thick, pad, box: { w, h } };
}
