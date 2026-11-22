// A window's art, painted like the walls it is set into (wall-paint.mjs, decor-paint.mjs's PAINT_KIT).
//
// Animater already knew about windows: engines/motion/window-state.mjs gives eight kinds that open and close, with
// what each lets through, and wall-shadows.mjs throws their light into the room. None of that is repeated here —
// this paints what those kinds LOOK like from above, and adds the four that never close at all, because an arrow
// slit and a broken-out frame are openings rather than windows with a state.
//
// A window from above is not a hole and not a door: the stone is cut through, but something is left in the
// opening — a sill to see over, bars to see through, glass you cannot get through. So it reads as a band across the
// gap, thinner than the wall, with the opening's own dark either side of it. Opened, it is an empty frame.
//
// Pure canvas 2D: no Foundry, no PIXI, no clock.

import { PAINT_KIT, seeded } from './decor-paint.mjs';
import { LIT, PICTURE_SHARP } from './wall-paint.mjs';

/**
 * How many picture pixels go to one map pixel. Windows are small and full of thin lines, so painting them at map size
 * left the bars and glazing ragged; the picture is painted bigger and laid on the map at its own size.
 */
const sharpOf = (look) => Math.max(1, Number(look?.sharp) || PICTURE_SHARP);

const { poly, line, shade, noise, INK, defaultCanvas } = PAINT_KIT;

/** How thick a window is drawn, as a share of a grid square: it fills the wall it is set into. */
export const WINDOW_THICK = 0.3;

const box = (cx, cy, halfLong, halfThick) => [[-halfLong, -halfThick], [halfLong, -halfThick], [halfLong, halfThick], [-halfLong, halfThick]].map(([u, v]) => [cx + u, cy + v]);

function face(g, rng, pts, base, o, { grain = 0.1, blotch = 3, sharp = true } = {}) {
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
  for (let i = 0; i < Math.min(700, w * h * 0.4); i++) { g.fillStyle = rng() < 0.55 ? `rgba(14,12,9,${grain})` : `rgba(240,235,222,${grain * 0.7})`; g.fillRect(x0 + rng() * w, y0 + rng() * h, 1, 1); }
  g.strokeStyle = 'rgba(244,238,224,0.16)'; g.lineWidth = Math.max(1, h * 0.1);
  g.beginPath(); g.moveTo(x0, y0 + h * 0.06); g.lineTo(x1, y0 + h * 0.06); g.stroke();
  g.strokeStyle = 'rgba(12,10,7,0.3)';
  g.beginPath(); g.moveTo(x0, y1 - h * 0.06); g.lineTo(x1, y1 - h * 0.06); g.stroke();
  g.restore();
  if (sharp) poly(g, pts); else path();
  g.strokeStyle = INK; g.lineWidth = o.ink * 1.2; g.lineJoin = 'round'; g.stroke();
}

/** What every window has under whatever fills it: the dark of the opening, seen down into. */
function opening(g, len, thick) {
  poly(g, box(0, 0, len / 2, thick / 2)); g.fillStyle = '#17140f'; g.fill();
  g.save(); poly(g, box(0, 0, len / 2, thick / 2)); g.clip();
  g.filter = `blur(${thick * 0.3}px)`;
  g.strokeStyle = 'rgba(6,5,4,0.8)'; g.lineWidth = thick * 0.5;
  poly(g, box(0, 0, len / 2, thick / 2)); g.stroke();
  g.filter = 'none'; g.restore();
}

/** The stone ledge an opening is left with. Every window has one; an open one is nothing but this. */
const sill = (g, rng, o, len, thick, stone = '#6e6c64') => {
  for (const way of [-1, 1]) face(g, rng, box(way * len * 0.42, 0, len * 0.08, thick * 0.34), stone, o, { grain: 0.1, blotch: 1 });
};

/** A sheet of something in the opening: glass, cloth, paper. `tint` its colour, `through` how much light it passes. */
const sheet = (g, len, thick, tint, alpha) => {
  const pane = box(0, 0, len * 0.42, thick * 0.34);
  poly(g, pane); g.fillStyle = tint.replace('ALPHA', String(alpha)); g.fill();
  return pane;
};
const lead = (g, len, thick, across, colour, o) => {
  for (let i = 1; i < across; i++) { const x = -len * 0.42 + (len * 0.84 * i) / across; line(g, [[x, -thick * 0.34], [x, thick * 0.34]], colour, Math.max(1, o.unit * 0.008)); }
};

const STONE = '#6e6c64', IRON = '#34332f', WOOD = '#6b5538';

/**
 * Every window Animater can paint. The first eight are the kinds that already open and close
 * (window-state.mjs CLOSING_WINDOWS) — this only gives them a face. The last four never close: they are openings,
 * and have no state to be in.
 * `opens` says which is which. `wall` lists the wall materials each suits, for picking one to match.
 */
export const WINDOW_ART = Object.freeze({
  woodWindow: {
    label: 'Wooden', about: 'boards across the opening: shut, it stops everything', opens: true, wall: ['timber', 'palisade'],
    pane(g, rng, o, { len, thick }) {
      face(g, rng, box(0, 0, len * 0.44, thick * 0.36), WOOD, o, { grain: 0.11 });
      for (let i = 1; i < 4; i++) { const x = -len * 0.44 + (len * 0.88 * i) / 4; line(g, [[x, -thick * 0.36], [x, thick * 0.36]], 'rgba(14,11,8,0.45)', o.ink * 0.9); }
    },
  },
  shutterWindow: {
    label: 'Shutters', about: 'two leaves that swing out, with slats between', opens: true, wall: ['timber', 'adobe', 'fieldstone'],
    pane(g, rng, o, { len, thick, slats = false }) {
      for (const way of [-1, 1]) { g.save(); g.translate((way * len) / 4, 0); this.leaf(g, rng, o, { len: len / 2, thick, slats }); g.restore(); }
    },
    leaf(g, rng, o, { len, thick, slats = false }) {
      face(g, rng, box(0, 0, len / 2, thick * 0.34), WOOD, o, { grain: 0.11 });
      // Slats open: fine lines of light across the leaf, which is what the GM sees of them from above.
      const lines = slats ? 7 : 3;
      for (let i = 1; i < lines; i++) { const x = -len / 2 + len * (i / lines); line(g, [[x, -thick * 0.34], [x, thick * 0.34]], slats ? 'rgba(248,240,216,0.35)' : 'rgba(14,11,8,0.45)', o.ink * 0.9); }
      line(g, [[-len * 0.4, -thick * 0.34], [-len * 0.4, thick * 0.34]], IRON, Math.max(1.4, o.unit * 0.012));
    },
  },
  glassWindow: {
    label: 'Glass', about: 'clear panes: light and sight come through', opens: true, wall: ['dressed', 'brick'],
    pane(g, rng, o, { len, thick }) {
      const pane = sheet(g, len, thick, 'rgba(176,206,222,ALPHA)', 0.34);
      g.save(); poly(g, pane); g.clip();
      for (let i = 0; i < 5; i++) { const x = -len / 2 + rng() * len; line(g, [[x, -thick * 0.34], [x + thick * 0.2, thick * 0.34]], 'rgba(232,245,252,0.2)', Math.max(1, thick * 0.08)); }
      g.restore();
      lead(g, len, thick, 6, IRON, o);
      poly(g, pane); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
    },
  },
  curtainWindow: {
    label: 'Curtains', about: 'cloth drawn across: only a dim light comes through', opens: true, wall: ['timber', 'adobe', 'brick'],
    pane(g, rng, o, { len, thick }) {
      const pts = [];
      for (let i = 0; i <= 18; i++) { const x = -len * 0.44 + len * 0.88 * (i / 18); pts.push([x, -thick * 0.34 + (noise(x * 0.07, 3) - 0.5) * thick * 0.4]); }
      for (let i = 18; i >= 0; i--) { const x = -len * 0.44 + len * 0.88 * (i / 18); pts.push([x, thick * 0.34 + (noise(x * 0.07, 9) - 0.5) * thick * 0.4]); }
      face(g, rng, pts, '#7a4a44', o, { grain: 0.1, sharp: false });
      for (let i = 1; i < 8; i++) { const x = -len * 0.44 + (len * 0.88 * i) / 8; line(g, [[x + (noise(x * 0.1, 2) - 0.5) * thick * 0.25, -thick * 0.34], [x, thick * 0.34]], 'rgba(30,14,12,0.35)', o.ink * 0.8); }
    },
  },
  mosaicWindow: {
    label: 'Mosaic', about: 'coloured glass: the light comes in coloured', opens: true, wall: ['dressed', 'brick'],
    pane(g, rng, o, { len, thick }) {
      // Muted, as the maps are: coloured glass seen from above is a hint of colour, not a paint box.
      const tints = ['rgba(142,74,66,0.4)', 'rgba(82,102,134,0.4)', 'rgba(166,138,72,0.4)', 'rgba(88,114,86,0.4)'];
      const pane = box(0, 0, len * 0.42, thick * 0.34);
      g.save(); poly(g, pane); g.clip();
      for (let i = 0; i < 9; i++) {
        const x = -len * 0.42 + (len * 0.84 * i) / 9;
        poly(g, box(x + len * 0.046, 0, len * 0.046, thick * 0.34)); g.fillStyle = tints[Math.floor(rng() * tints.length)]; g.fill();
      }
      g.restore();
      lead(g, len, thick, 9, '#2b2a27', o);
      poly(g, pane); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
    },
  },
  leadedWindow: {
    label: 'Leaded', about: 'diamonds in lead: light in a fine net', opens: true, wall: ['dressed', 'brick', 'timber'],
    pane(g, rng, o, { len, thick }) {
      const pane = sheet(g, len, thick, 'rgba(188,210,220,ALPHA)', 0.3);
      g.save(); poly(g, pane); g.clip();
      const step = Math.max(4, len * 0.07);
      for (let x = -len * 0.6; x < len * 0.6; x += step) {
        line(g, [[x, -thick * 0.34], [x + thick * 0.68, thick * 0.34]], 'rgba(44,42,38,0.55)', Math.max(0.8, o.unit * 0.006));
        line(g, [[x, thick * 0.34], [x + thick * 0.68, -thick * 0.34]], 'rgba(44,42,38,0.55)', Math.max(0.8, o.unit * 0.006));
      }
      g.restore();
      poly(g, pane); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
    },
  },
  roseWindow: {
    label: 'Rose', about: 'a wheel of coloured glass', opens: true, wall: ['dressed'],
    pane(g, rng, o, { len, thick }) {
      const pane = sheet(g, len, thick, 'rgba(118,98,128,ALPHA)', 0.32);
      g.save(); poly(g, pane); g.clip();
      // From above, the wheel reads as its spokes crossing the opening and a bright heart in the middle.
      for (let i = 0; i < 10; i++) { const x = -len * 0.42 + (len * 0.84 * i) / 9; line(g, [[x, -thick * 0.34], [x, thick * 0.34]], 'rgba(40,36,44,0.5)', Math.max(0.8, o.unit * 0.006)); }
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, len * 0.22);
      glow.addColorStop(0, 'rgba(250,228,180,0.5)'); glow.addColorStop(1, 'rgba(250,228,180,0)');
      g.fillStyle = glow; g.fillRect(-len * 0.5, -thick, len, thick * 2);
      g.restore();
      poly(g, pane); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
    },
  },
  frostedWindow: {
    label: 'Frosted', about: 'oiled paper or frosted glass: a soft glow, nothing seen through', opens: true, wall: ['dressed', 'timber', 'adobe'],
    pane(g, rng, o, { len, thick }) {
      const pane = sheet(g, len, thick, 'rgba(226,226,216,ALPHA)', 0.5);
      g.save(); poly(g, pane); g.clip();
      g.filter = `blur(${thick * 0.2}px)`;
      for (let i = 0; i < 6; i++) { const x = -len * 0.4 + rng() * len * 0.8; g.fillStyle = 'rgba(248,248,240,0.25)'; g.beginPath(); g.ellipse(x, (rng() - 0.5) * thick * 0.4, len * 0.08, thick * 0.2, 0, 0, 6.283); g.fill(); }
      g.filter = 'none'; g.restore();
      lead(g, len, thick, 4, '#4a4842', o);
      poly(g, pane); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
    },
  },
  // ---- and the four that never close -------------------------------------------------------------------------
  sillWindow: {
    label: 'Open sill', about: 'a gap with a ledge: see over it, climb through it', opens: false, wall: ['dressed', 'fieldstone', 'brick', 'adobe'],
    pane(g, rng, o, { len, thick }) {
      face(g, rng, box(0, 0, len * 0.44, thick * 0.26), STONE, o, { grain: 0.1 });
      for (const at of [-len * 0.2, len * 0.2]) line(g, [[at, -thick * 0.26], [at, thick * 0.26]], 'rgba(14,11,8,0.4)', o.ink);
    },
  },
  barredWindow: {
    label: 'Barred', about: 'iron set into the stone: light and sight, nothing else', opens: false, wall: ['dressed', 'hewn'],
    pane(g, rng, o, { len, thick }) {
      for (let i = 0; i < 5; i++) { const x = -len / 2 + (len * (i + 0.5)) / 5; face(g, rng, box(x, 0, Math.max(1, thick * 0.09), thick / 2), '#2f2e2a', o, { grain: 0.07, blotch: 1 }); }
      face(g, rng, box(0, 0, len / 2, Math.max(1, thick * 0.07)), shade('#2f2e2a', 0.05), o, { grain: 0.07, blotch: 1 });
    },
  },
  arrowWindow: {
    label: 'Arrow slit', about: 'a slot: shoot out, nothing comes in', opens: false, wall: ['dressed', 'hewn'],
    pane(g, rng, o, { len, thick }) {
      face(g, rng, box(0, 0, len / 2, thick / 2), '#6a6860', o, { grain: 0.11 });
      poly(g, box(0, 0, len * 0.04, thick * 0.46)); g.fillStyle = '#15120e'; g.fill();
      poly(g, box(0, 0, len * 0.04, thick * 0.46)); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
      // The splay: the stone cut away inside so an archer has somewhere to stand.
      g.beginPath(); g.moveTo(-len * 0.2, thick * 0.5); g.lineTo(len * 0.2, thick * 0.5); g.lineTo(len * 0.05, thick * 0.1); g.lineTo(-len * 0.05, thick * 0.1); g.closePath();
      g.fillStyle = 'rgba(16,13,10,0.3)'; g.fill();
    },
  },
  brokenWindow: {
    label: 'Broken out', about: 'whatever was in it is gone: a ruin, a siege', opens: false, wall: ['fieldstone', 'hewn', 'natural'],
    pane(g, rng, o, { len, thick }) {
      sill(g, rng, o, len, thick, STONE);
      for (const at of [-len * 0.18, len * 0.05, len * 0.22]) {
        const h = thick * (0.1 + noise(at * 0.1, 4) * 0.2);
        line(g, [[at, -thick * 0.45], [at + thick * 0.05, -thick * 0.45 + h]], shade('#2f2e2a', 0.1), Math.max(1, thick * 0.07));
      }
    },
  },
});

/**
 * How a window opens. A window is not a picture swapped for an empty frame when it opens — doing that made every
 * opened window look the same, whatever it had been (Roi: "opned window all look the same.. we need to do it like
 * doors with actaul moving parts"). It has leaves, and the leaves move: a casement pair swings out on its hinges at
 * either end, curtains are drawn aside along the wall, and an opening has no leaves because there is nothing in it.
 */
export const WINDOW_MOTION = Object.freeze(Object.fromEntries(Object.entries(WINDOW_ART).map(([id, w]) =>
  [id, Object.freeze(!w.opens ? { parts: 0, motion: 'none' } : id === 'curtainWindow' ? { parts: 2, motion: 'slide' } : { parts: 2, motion: 'swing' })])));
/** How far a casement stands open, in radians, and how far a curtain is drawn aside, as a share of its own width. */
export const WINDOW_SWING = Math.PI * 0.44;
export const WINDOW_DRAW_ASIDE = 0.7;

export const WINDOW_IDS = Object.freeze(Object.keys(WINDOW_ART));
export const WINDOW_CHOICES = Object.freeze(Object.entries(WINDOW_ART).map(([id, w]) => Object.freeze({ id, label: w.label, about: w.about, opens: w.opens })));
/** The ones that never close: openings, with no state to be in. */
export const OPEN_WINDOWS = Object.freeze(WINDOW_IDS.filter((id) => !WINDOW_ART[id].opens));
/** The window a wall of this material would have, unless the GM says otherwise. */
export const windowFor = (material) => WINDOW_IDS.find((id) => WINDOW_ART[id].wall.includes(material)) ?? 'sillWindow';

/**
 * One window, painted straight, its opening running left to right across the middle of the picture, with room round
 * it. An open window is an empty frame: the opening and its ledge, and nothing in it.
 * Returns { canvas, middle: [x, y], length, thick }.
 */
/** The picture's own measurements, shared by the frame and its leaves so they line up on the map. */
const sized = (length, look) => {
  const unit = look.grid ?? 100, len = Math.max(8, length), thick = unit * (look.thick ?? WINDOW_THICK);
  // Only enough room for the ink line, never a margin of its own.
  const pad = Math.ceil(Math.max(2, thick * 0.14));
  return { unit, len, thick, pad, o: { unit, ink: Math.max(0.7, unit / 90) } };
};

// A window hung with a picture the GM owns (roof-cover.mjs) in place of our painted one. Such a picture is one
// window, shut: a pane with a jamb at each end. Ours is an opening that stays and leaves that move, so the picture is
// taken apart where it says to be: its jambs are painted with the opening and stay in the wall, and the pane between
// them is the leaves — halved at its middle for a pair, each half hung at its own jamb. The whole of it is laid to
// the opening's own length, jamb to jamb. (Roi, of the pack's windows: "it needs to suuport opening and closing
// windows and double leaves".) What kind of window it is — whether it opens, how many leaves — stays ours to say.
const coverOf = (look) => (look?.cover?.image && look.cover.width > 0 && look.cover.height > 0 ? look.cover : null);
const jambsOf = (c) => { const j = c.jambs ?? {}, x0 = Number.isFinite(j.x0) ? j.x0 : 0, x1 = Number.isFinite(j.x1) && j.x1 > x0 ? j.x1 : c.width; return { x0, x1, a: Number.isFinite(j.a) ? Math.max(x0, Math.min(x1, j.a)) : x0, b: Number.isFinite(j.b) ? Math.max(x0, Math.min(x1, j.b)) : x1, tall: Number.isFinite(j.tall) && j.tall > 0 ? j.tall : c.height }; };
/** A stretch of a covering picture's columns, laid where the whole picture would put them: `left` where its first painted column goes. */
const coverPiece = (g, c, from, to, left, k) => { if (to - from > 0.5) g.drawImage(c.image, from, 0, to - from, c.height, left + (from - jambsOf(c).x0) * k, -(c.height * k) / 2, (to - from) * k, c.height * k); };

/**
 * The opening itself, with nothing in it: the dark of the gap and the ledge it was cut with. It never moves, so it
 * is painted once and left; whatever fills it hangs over it.
 */
export function paintWindowFrame(kind, length, look = {}, make = defaultCanvas) {
  const cover = coverOf(look), size = sized(length, look), { len, thick, o } = size;
  // (Room for a picture's jambs, which may stand prouder of the wall than our own ledge does.)
  const scale = cover ? len / (jambsOf(cover).x1 - jambsOf(cover).x0) : 0, pad = cover ? Math.max(size.pad, Math.ceil((jambsOf(cover).tall * scale - thick) / 2) + 2) : size.pad;
  const w0 = Math.ceil(len + pad * 2), h0 = Math.ceil(thick + pad * 2), k = sharpOf(look);
  const canvas = make(Math.ceil(w0 * k), Math.ceil(h0 * k)), g = canvas.getContext('2d');
  if (!g) return null;
  const rng = seeded(look.seed ?? 4);
  g.scale(k, k);
  g.translate(pad + len / 2, pad + thick / 2);
  opening(g, len, thick);
  if (cover) {
    // Its jambs; and all of it, where the window is of a kind with nothing to open.
    const j = jambsOf(cover), leaves = WINDOW_MOTION[kind]?.parts > 0 && j.b - j.a > 2;
    if (leaves) { coverPiece(g, cover, j.x0, j.a, -len / 2, scale); coverPiece(g, cover, j.b, j.x1, -len / 2, scale); }
    else coverPiece(g, cover, j.x0, j.x1, -len / 2, scale);
  } else sill(g, rng, o, len, thick, STONE);
  return { canvas, middle: [pad + len / 2, pad + thick / 2], length: len, thick, pad, box: { w: w0, h: h0 } };
}

/**
 * One leaf of a window, painted straight, hinged at the LEFT end of its picture — the same arrangement a door's leaf
 * uses, so it can be hung at a point and turned about it. A kind with two leaves gets this twice, mirrored.
 */
export function paintWindowLeaf(kind, length, look = {}, make = defaultCanvas) {
  const w = WINDOW_ART[kind] ?? WINDOW_ART.sillWindow;
  const paint = w.leaf ?? w.pane;
  if (!paint || !WINDOW_MOTION[kind]?.parts) return null;
  const cover = coverOf(look), size = sized(length, look), { len, thick, o } = size;
  // A picture's pane, or the half of it this leaf is: the whole window is `parts` leaves long, and this leaf hangs at
  // the opening's end, so its pane begins where the picture's jamb leaves off.
  const parts = WINDOW_MOTION[kind].parts, j = cover ? jambsOf(cover) : null, scale = cover ? (len * parts) / (j.x1 - j.x0) : 0;
  if (cover && !(j.b - j.a > 2)) return null;
  const pad = cover ? Math.max(size.pad, Math.ceil((cover.height * scale - thick) / 2) + 2) : size.pad;
  const w0 = Math.ceil(len + pad * 2), h0 = Math.ceil(thick + pad * 2), k = sharpOf(look);
  const canvas = make(Math.ceil(w0 * k), Math.ceil(h0 * k)), g = canvas.getContext('2d');
  if (!g) return null;
  const rng = seeded(look.seed ?? 4);
  g.scale(k, k);
  g.translate(pad + len / 2, pad + thick / 2);
  if (cover) coverPiece(g, cover, j.a, parts > 1 ? (j.a + j.b) / 2 : j.b, -len / 2, scale);
  else paint.call(w, g, rng, o, { len, thick, slats: look.slats === true, open: 0 });
  return { canvas, hinge: [pad, pad + thick / 2], length: len, thick, pad, box: { w: w0, h: h0 } };
}

export function paintWindowPane(kind, length, look = {}, make = defaultCanvas) {
  const w = WINDOW_ART[kind] ?? WINDOW_ART.sillWindow;
  const unit = look.grid ?? 100, len = Math.max(8, length), thick = unit * (look.thick ?? WINDOW_THICK);
  // Only enough room for the ink line, never a margin of its own: the picture is laid on the map at its own size, so
  // padding here makes the window stand proud of the wall it is set into. It was a whole wall's thickness, and on a
  // 200px grid that put an 88px pane on the map 180px tall (Roi: "why does it look like this like it's not part of
  // the wall?").
  const pad = Math.ceil(Math.max(2, thick * 0.14));
  const width = Math.ceil(len + pad * 2), height = Math.ceil(thick + pad * 2), k = sharpOf(look);
  const canvas = make(Math.ceil(width * k), Math.ceil(height * k)), g = canvas.getContext('2d');
  if (!g) return null;
  const o = { unit, ink: Math.max(0.7, unit / 90) }, rng = seeded(look.seed ?? 4);
  g.scale(k, k);
  g.translate(pad + len / 2, pad + thick / 2);
  opening(g, len, thick);
  const open = w.opens ? Math.max(0, Math.min(1, look.open ?? 0)) : 0;
  // Wide open, there is nothing in the frame but the ledge it was set in — except shutters, which are still there,
  // standing back against the wall.
  if (open >= 1 && kind !== 'shutterWindow') sill(g, rng, o, len, thick, STONE);
  else w.pane(g, rng, o, { len, thick, open, slats: look.slats === true, swing: look.way === -1 ? -1 : 1 });
  return { canvas, middle: [pad + len / 2, pad + thick / 2], length: len, thick, pad, box: { w: width, h: height } };
}
