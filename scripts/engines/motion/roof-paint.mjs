// A roof's art, painted like the walls it sits on (wall-paint.mjs, decor-paint.mjs's PAINT_KIT).
//
// A roof seen from straight above is a shape with a ridge: the slopes fall away from it to the eaves, and it
// overhangs the walls, which is why a roof reads as a building rather than as a lid.
//
// What it is NOT is a shaded solid. Looking at how these maps draw roofs, the tone across one is almost flat — what
// says "pitched roof covered in tiles" is the stuff drawn as the separate things it is made of: tiles, slates,
// shingles or bundles of reed, laid in courses from the eave up, each course lapping the one below and casting its
// shadow on it. Shade the facets hard instead and you get an architect's drawing of a hipped roof. So the facets are
// barely shaded here, the material carries it, and the frame is timbers — a ridge beam with hips running down to
// the corners.
//
// Pure canvas 2D: no Foundry, no PIXI, no clock.

import { PAINT_KIT, seeded } from './decor-paint.mjs';
import { coverCourses } from './roof-cover.mjs';
import { LIGHT, underLight, tintedKind, PICTURE_SHARP } from './wall-paint.mjs';

const { poly, line, mix, noise, INK, defaultCanvas } = PAINT_KIT;

/**
 * How far the eaves hang past the wall, in grid squares. A room's box is drawn on the wall centres, so half the wall
 * — about 0.17 squares of it — is already outside the box before the eave starts. At 0.18 the eave landed exactly on
 * the wall's outer face and its ragged edge left the wall showing as a dark line above the roof. A real eave throws
 * water clear of the wall it stands on, so this clears the wall and then some.
 */
export const ROOF_OVERHANG = 0.42;

/**
 * How strongly a slope says which way it is turned: 0 flat, 1 one side white and the other black. The painted look
 * carries depth in the material and the floor shadow rather than in facet shading, so this stays gentle — but it
 * has to be enough to see, which at first it was not.
 */
export const ROOF_FACE_TONE = 0.35;

/**
 * How far past the eaves the roof throws its shadow, in grid squares. It has to clear ROOF_OVERHANG to be seen at
 * all, and at 0.42 against an overhang of 0.42 it did not: the shadow fell under the roof's own eaves and the only
 * thing saying the roof was above the ground was hidden beneath it.
 */
export const ROOF_SHADOW_REACH = 0.9;

/**
 * Whether the outer edge of a slope catches the light (1) or the eave darkens as it used to (0). Off: it was put
 * here to fight a roof that read as a bowl, and what was really causing that was timber along the joins. A roof in
 * a photograph has a dark line at its edge, not a bright one.
 */
export const ROOF_EAVE_LIGHT = 0;

/**
 * A covering's own colour on a slope turned this way: the stuff itself painted lighter or darker, rather than a
 * wash laid over it afterwards. A wash was the first try and it was wrong — a flat fill over several thousand
 * slates lowers their contrast with them, so the lit face came out a pale film with the texture smothered under it
 * (Roi: "im not too sure about this design\integration"). Toning the base instead means each slate is painted its
 * own slightly lighter shade and keeps its grain, its variation and its ink: the material carries the light, which
 * is the whole principle of this style.
 */
export const tonedBase = (base, lit, tone = ROOF_FACE_TONE) => {
  const turn = (Math.max(0, Math.min(1, Number(lit) || 0)) - 0.5) * 2;
  const much = Math.abs(turn) * Math.max(0, Math.min(1, Number(tone) || 0));
  return much < 0.004 ? base : mix(base, turn > 0 ? '#fff7e4' : '#0b0906', much);
};

// ---------------------------------------------------------------------------------------------------- the shape

/**
 * A hipped roof over a rectangle (pure): a ridge along its length, a slope falling from the ridge to each eave, and
 * the four faces between. `over` is the overhang in pixels.
 */
export function hippedRoof(x, y, w, h, over = 0) {
  const left = x - over, right = x + w + over, top = y - over, low = y + h + over;
  const along = right - left >= low - top;
  const inset = Math.min(right - left, low - top) * 0.3;
  const ridge = along
    ? [[left + inset, (top + low) / 2], [right - inset, (top + low) / 2]]
    : [[(left + right) / 2, top + inset], [(left + right) / 2, low - inset]];
  const eave = [[left, top], [right, top], [right, low], [left, low]];
  // Every face is wound the way alongFace reads one: pts[0]→pts[1] along its own eave, pts[3]→pts[2] along the
  // ridge above it, and for a hip end the apex last. Half of them used to start up the fall instead, which swapped
  // across for up and laid that face's slates on their side — one slope of a roof in courses and the other in
  // columns (Roi: "upper part horizontal tiles, lower part vertical, why?").
  const faces = along
    ? [
        { pts: [eave[0], eave[1], ridge[1], ridge[0]], away: [0, -1] },
        { pts: [eave[3], eave[2], ridge[1], ridge[0]], away: [0, 1] },
        { pts: [eave[0], eave[3], ridge[0]], away: [-1, 0] },
        { pts: [eave[1], eave[2], ridge[1]], away: [1, 0] },
      ]
    : [
        { pts: [eave[0], eave[3], ridge[1], ridge[0]], away: [-1, 0] },
        { pts: [eave[1], eave[2], ridge[1], ridge[0]], away: [1, 0] },
        { pts: [eave[0], eave[1], ridge[0]], away: [0, -1] },
        { pts: [eave[3], eave[2], ridge[1]], away: [0, 1] },
      ];
  return { eave, ridge, faces, along, box: { x: left, y: top, w: right - left, h: low - top } };
}

/**
 * A gabled roof: the ridge runs the whole length to the end walls, so there are two slopes and no hips. The ends are
 * upright gables, which from above show as the edge of the roof and nothing more.
 */
export function gabledRoof(x, y, w, h, over = 0) {
  const left = x - over, right = x + w + over, top = y - over, low = y + h + over;
  const along = right - left >= low - top;
  const ridge = along
    ? [[left, (top + low) / 2], [right, (top + low) / 2]]
    : [[(left + right) / 2, top], [(left + right) / 2, low]];
  const eave = [[left, top], [right, top], [right, low], [left, low]];
  // Both slopes wound alike: along the eave first, so both are laid in courses rather than one of them in columns.
  const faces = along
    ? [{ pts: [eave[0], eave[1], ridge[1], ridge[0]], away: [0, -1] }, { pts: [eave[3], eave[2], ridge[1], ridge[0]], away: [0, 1] }]
    : [{ pts: [eave[0], eave[3], ridge[1], ridge[0]], away: [-1, 0] }, { pts: [eave[1], eave[2], ridge[1], ridge[0]], away: [1, 0] }];
  return { eave, ridge, faces, along, gable: true, box: { x: left, y: top, w: right - left, h: low - top } };
}

/** A shed roof: one slope, falling from a high side to a low one. For a lean-to, a porch, an outhouse. */
export function shedRoof(x, y, w, h, over = 0, high = 'north') {
  const left = x - over, right = x + w + over, top = y - over, low = y + h + over;
  const eave = [[left, top], [right, top], [right, low], [left, low]];
  const ridge = high === 'north' ? [eave[0], eave[1]] : high === 'south' ? [eave[3], eave[2]] : high === 'west' ? [eave[0], eave[3]] : [eave[1], eave[2]];
  const fallsTo = high === 'north' ? [eave[3], eave[2]] : high === 'south' ? [eave[0], eave[1]] : high === 'west' ? [eave[1], eave[2]] : [eave[0], eave[3]];
  const away = high === 'north' ? [0, 1] : high === 'south' ? [0, -1] : high === 'west' ? [1, 0] : [-1, 0];
  return { eave, ridge, faces: [{ pts: [fallsTo[0], fallsTo[1], ridge[1], ridge[0]], away }], along: true, shed: true, box: { x: left, y: top, w: right - left, h: low - top } };
}

/** A pyramid: four slopes meeting at a point. For a tower, a gatehouse, a dovecote. */
export function pyramidRoof(x, y, w, h, over = 0) {
  const left = x - over, right = x + w + over, top = y - over, low = y + h + over;
  const peak = [(left + right) / 2, (top + low) / 2];
  const eave = [[left, top], [right, top], [right, low], [left, low]];
  const faces = [
    { pts: [eave[0], eave[1], peak], away: [0, -1] },
    { pts: [eave[1], eave[2], peak], away: [1, 0] },
    { pts: [eave[2], eave[3], peak], away: [0, 1] },
    { pts: [eave[3], eave[0], peak], away: [-1, 0] },
  ];
  return { eave, ridge: [peak, peak], faces, along: true, peak, box: { x: left, y: top, w: right - left, h: low - top } };
}

/** A cone: a round tower's cap, its slopes running down to a ring of eaves. */
export function conicalRoof(x, y, w, h, over = 0, sides = 14) {
  // Round, not stretched: a cone over a long room was coming out an ellipse, which is not a thing anybody builds.
  // It takes the room's narrow way as its width, so it sits in the room rather than being pulled across it.
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2 + over, rx = r, ry = r;
  const peak = [cx, cy], eave = [];
  for (let i = 0; i < sides; i++) { const a = (i / sides) * Math.PI * 2; eave.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  const faces = eave.map((p, i) => {
    const q = eave[(i + 1) % sides], mid = [(p[0] + q[0]) / 2 - cx, (p[1] + q[1]) / 2 - cy], l = Math.hypot(mid[0], mid[1]) || 1;
    return { pts: [p, q, peak], away: [mid[0] / l, mid[1] / l] };
  });
  return { eave, ridge: [peak, peak], faces, along: true, peak, round: true, box: { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 } };
}

/** The forms a roof can take, and which one a room of this shape would have if nobody says otherwise. */
export const ROOF_FORMS = Object.freeze({
  hip: { label: 'Hipped', about: 'four slopes, the ends falling in too', make: hippedRoof },
  gable: { label: 'Gabled', about: 'two slopes, upright ends: a cottage, a hall', make: gabledRoof },
  shed: { label: 'Lean-to', about: 'one slope, high at one side: a porch, an outhouse', make: shedRoof },
  pyramid: { label: 'Pyramid', about: 'four slopes to a point: a tower, a gatehouse', make: pyramidRoof },
  cone: { label: 'Conical', about: 'a round cap: a round tower, a mill', make: conicalRoof },
});
export const ROOF_FORM_IDS = Object.freeze(Object.keys(ROOF_FORMS));
export const ROOF_FORM_CHOICES = Object.freeze(Object.entries(ROOF_FORMS).map(([id, f]) => Object.freeze({ id, label: f.label, about: f.about })));

/**
 * How much of its own box a room may fill and still count as round. A circle fills a quarter of pi of the box it
 * sits in, about 0.79; a rectangular room fills the lot. Anything up to this is round enough for a cone.
 */
export const ROUND_ENOUGH = 0.88;

/**
 * Can a room take this form? Only the cone is fussy, and it is fussy for a real reason: a cone is a circle, so
 * whatever is in the corners of its box is left open to the sky.
 *
 * Being roughly square is not enough — that was the first try, and a square room passed it while its four corners
 * stood out in the open (Roi: "we still allow conical roof on a rectangle walls\room"). What a cone wants is a room
 * that is actually round, which shows in how much of its own box the room fills. A room that says how many squares
 * it covers is measured; one that does not — a roof read back from a scene's flags, which only kept the box — is
 * taken as it was when it was laid.
 */
export function formFits(form, room, { grid = 100 } = {}) {
  if (form !== 'cone') return true;
  if (!room || !(room.w > 0) || !(room.h > 0)) return false;
  if (Math.min(room.w, room.h) / Math.max(room.w, room.h) < 0.8) return false;
  // The walls themselves know better than the squares do. A room walled as a ring is round however small it is: a
  // tower two squares across fills every square of its own box, and the squares alone would call it a box.
  if (typeof room.round === 'boolean') return room.round;
  const box = (room.w / grid) * (room.h / grid);
  if (Number.isFinite(room.squares) && box > 0 && room.squares / box > ROUND_ENOUGH) return false;
  return true;
}

/** The form a room of this shape would take: a square one hips, a long one gables, a small lean-to sheds. */
export function formFor(room, { grid = 100 } = {}) {
  if (!room || !(room.w > 0) || !(room.h > 0)) return 'gable';
  const long = Math.max(room.w, room.h), short = Math.min(room.w, room.h);
  if (short <= grid * 1.2 && long <= grid * 2.4) return 'shed';
  if (long / short < 1.25 && long <= grid * 3.5) return 'pyramid';
  return long / short > 1.5 ? 'gable' : 'hip';
}

/** One roof's shape, whatever form it takes. */
export const roofShape = (form, x, y, w, h, over, extra) => (ROOF_FORMS[form] ?? ROOF_FORMS.hip).make(x, y, w, h, over, extra);

/** How lit a face is: 1 turned into the light, 0 turned away. Used gently — see the note at the top. */
export const litness = (away) => Math.max(0, Math.min(1, 0.5 - (-(away[0] * LIGHT.at[0]) - away[1] * LIGHT.at[1]) * 0.5));

/** A point on a face: `t` across it, `u` from its eave (0) to its ridge (1). */
export function alongFace(face, t, u = 0.5) {
  const pts = face.pts;
  const a = [pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t];
  const b = pts.length > 3
    ? [pts[3][0] + (pts[2][0] - pts[3][0]) * t, pts[3][1] + (pts[2][1] - pts[3][1]) * t]
    : pts[2];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

// ---------------------------------------------------------------------------------------------------- the covering

/**
 * The stuff a roof is covered with, drawn as the separate things it is: courses from the eave up, each lapping the
 * one below and offset half a piece from it, each piece its own shape with the shadow of the next falling on it.
 */
function laid(g, rng, o, face, base, { rows = 7, across = 12, lap = 0.45, vary = 0.1, piece = null, shape }) {
  // How many pieces are worth drawing depends on how big the face actually is. A roof in a swatch an inch across
  // was drawing the same four hundred tiles as one over a hall, and painting eight of those at once hung the page.
  const span = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const wide = Math.max(span(face.pts[0], face.pts[1]), 1), deep = Math.max(span(face.pts[0], face.pts[face.pts.length - 1]), 1);
  const least = Math.max(4, o.unit * 0.055); // no piece smaller than this, however many were asked for
  // A slate is a slate: the same size on a cottage and on a hall. Counting pieces instead of sizing them stretched
  // them with the building, so the slate over a long hall came out reading as flagstones. `piece` is the real size
  // of one, across the fall and up it, in grid squares — a fifth of a square is about a foot.
  if (piece) {
    // The floor is `least`, not the old fixed count: on a hall the real size asks for far more pieces than the
    // count ever did, and clamping back to the count is what made them grow with the building in the first place.
    across = Math.round(wide / Math.max(least, o.unit * piece[0]));
    rows = Math.round(deep / Math.max(least, o.unit * piece[1]));
  } else {
    across = Math.min(across, Math.round(wide / least));
    rows = Math.min(rows, Math.round(deep / least));
  }
  across = Math.max(2, across);
  rows = Math.max(2, rows);
  // Real sizes over a great hall mean thousands of pieces, and painting that hangs the page the way the swatches
  // once did. Past a ceiling they grow together rather than multiply.
  const MOST = 1600;
  if (across * rows > MOST) { const by = Math.sqrt(MOST / (across * rows)); across = Math.max(2, Math.round(across * by)); rows = Math.max(2, Math.round(rows * by)); }
  // How far up the slope a course sits, said in the courses themselves. Washing a gradient over the face did
  // nothing at all: it was painted before the pieces and every slate went straight over the top of it, which is
  // why turning it up changed nothing on the map (Roi: "i dont see any difference besides the shadow"). The eave
  // course catches the sky where it stands up off the wall; the courses up against the ridge sit in its shade.
  const edge = Math.max(0, Math.min(1, Number(o.eaveLight) || 0));
  const upSlope = (u) => (u < 0.3 ? (0.3 - u) / 0.3 : u > 0.62 ? -((u - 0.62) / 0.38) : 0);
  for (let i = 0; i < rows; i++) {
    const u0 = i / rows, u1 = (i + 1) / rows + lap / rows, off = (i % 2) * (0.5 / across);
    const shift = edge * upSlope((i + 0.5) / rows);
    for (let k = 0; k < across; k++) {
      const t0 = k / across, t1 = (k + 1) / across;
      const corners = [
        alongFace(face, t0 + off, u0), alongFace(face, t1 + off, u0),
        alongFace(face, t1 + off, u1), alongFace(face, t0 + off, u1),
      ];
      const d = (noise(k * 3.3 + i * 1.7, i * 2.9) - 0.5) * vary * 2;
      let tone = d < 0 ? mix(base, '#120e07', -d * 1.7) : mix(base, '#fbf0d6', d * 1.3);
      if (shift > 0) tone = mix(tone, '#fff8e6', shift * 0.3);
      else if (shift < 0) tone = mix(tone, '#0b0906', -shift * 0.26);
      shape(g, corners, tone, rng, o);
    }
  }
}
/** A pantile: a rounded head lapping the course below, with the shadow it casts on it. */
const pantile = (g, c, tone, rng, o) => {
  const [a, b, bb, aa] = c, mid = [(aa[0] + bb[0]) / 2, (aa[1] + bb[1]) / 2];
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  g.quadraticCurveTo(mid[0] + (bb[0] - b[0]) * 0.1, mid[1] + (bb[1] - b[1]) * 0.1, aa[0], aa[1]);
  g.closePath();
  g.fillStyle = tone; g.fill();
  g.strokeStyle = 'rgba(18,10,6,0.55)'; g.lineWidth = o.ink * 0.9; g.stroke();
  g.save(); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.quadraticCurveTo(mid[0], mid[1], aa[0], aa[1]); g.closePath(); g.clip();
  g.strokeStyle = 'rgba(16,9,5,0.3)'; g.lineWidth = o.ink * 3;
  g.beginPath(); g.moveTo(aa[0], aa[1]); g.quadraticCurveTo(mid[0], mid[1], bb[0], bb[1]); g.stroke();
  g.restore();
};
/** A slate or a shingle: flat, squared off, with the lap line under it. */
const flatPiece = (g, c, tone, rng, o, rough = 0) => {
  const [a, b, bb, aa] = c;
  const j = rough ? (n) => (noise(n * 5.1, 3) - 0.5) * rough : () => 0;
  poly(g, [a, b, [bb[0] + j(bb[0]), bb[1] + j(bb[1])], [aa[0] + j(aa[0]), aa[1] + j(aa[1])]]);
  g.fillStyle = tone; g.fill();
  g.strokeStyle = 'rgba(14,12,9,0.45)'; g.lineWidth = o.ink * 0.8; g.stroke();
  line(g, [aa, bb], 'rgba(12,10,7,0.35)', o.ink * 1.6);
};
/** A bundle of reed: soft, wide, its head rounded over the course below, combed down its own length. */
const bundle = (g, c, tone, rng, o) => {
  const [a, b, bb, aa] = c, mid = [(aa[0] + bb[0]) / 2, (aa[1] + bb[1]) / 2];
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  g.quadraticCurveTo(mid[0] + (bb[0] - b[0]) * 0.22, mid[1] + (bb[1] - b[1]) * 0.22, aa[0], aa[1]);
  g.closePath();
  g.fillStyle = tone; g.fill();
  g.strokeStyle = 'rgba(40,26,10,0.3)'; g.lineWidth = o.ink * 0.7; g.stroke();
  g.save(); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.quadraticCurveTo(mid[0], mid[1], aa[0], aa[1]); g.closePath(); g.clip();
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    line(g, [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], [aa[0] + (bb[0] - aa[0]) * t, aa[1] + (bb[1] - aa[1]) * t]],
      i % 2 ? 'rgba(40,26,8,0.16)' : 'rgba(240,220,166,0.14)', o.ink * 0.6);
  }
  g.strokeStyle = 'rgba(30,18,6,0.28)'; g.lineWidth = o.ink * 3.5;
  g.beginPath(); g.moveTo(aa[0], aa[1]); g.quadraticCurveTo(mid[0], mid[1], bb[0], bb[1]); g.stroke();
  g.restore();
};
/** How many things of a real width `wide` (in grid squares) fit across a face, between `least` and `most` of them. */
function acrossFace(face, o, wide, least = 2, most = 90) {
  const span = Math.max(Math.hypot(face.pts[1][0] - face.pts[0][0], face.pts[1][1] - face.pts[0][1]), 1);
  return Math.max(least, Math.min(most, Math.round(span / Math.max(Math.max(4, o.unit * 0.055), o.unit * wide))));
}
/** Roughly how much map a face covers, in square pixels: the shoelace area of its corners. */
function faceArea(face) {
  const p = face.pts;
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return Math.abs(a) / 2;
}
/**
 * Boards running down the fall, each with its own tone and the shadow of the one beside it. `wide` is a board's real
 * width in grid squares, for the same reason a slate has one: a count stretches with the building.
 */
function boards(g, rng, o, face, base, wide = 0.22) {
  const count = acrossFace(face, o, wide);
  for (let i = 0; i < count; i++) {
    const t0 = i / count, t1 = (i + 1) / count;
    const quad = [alongFace(face, t0, 0), alongFace(face, t1, 0), alongFace(face, t1, 1), alongFace(face, t0, 1)];
    const d = (noise(i * 4.1, 7) - 0.5) * 0.26;
    poly(g, quad); g.fillStyle = d < 0 ? mix(base, '#140f07', -d * 1.6) : mix(base, '#f6ead0', d * 1.2); g.fill();
    line(g, [quad[0], quad[3]], 'rgba(16,10,5,0.45)', o.ink * 1.1);
    line(g, [[quad[0][0] + LIGHT.at[0] * o.ink * 1.2, quad[0][1] + LIGHT.at[1] * o.ink * 1.2], [quad[3][0] + LIGHT.at[0] * o.ink * 1.2, quad[3][1] + LIGHT.at[1] * o.ink * 1.2]], 'rgba(244,232,204,0.14)', o.ink * 0.9);
    g.save(); poly(g, quad); g.clip();
    for (let k = 0; k < 7; k++) {
      const u = rng();
      const p0 = alongFace(face, t0 + (t1 - t0) * (0.2 + rng() * 0.6), u);
      const p1 = alongFace(face, t0 + (t1 - t0) * (0.2 + rng() * 0.6), Math.min(1, u + 0.1 + rng() * 0.2));
      line(g, [p0, p1], rng() < 0.6 ? 'rgba(26,16,6,0.18)' : 'rgba(240,226,198,0.1)', o.ink * 0.6);
    }
    g.restore();
  }
}
/**
 * A ridge or a hip capped in the roof's own stuff: the row of pieces laid over the join, standing a little proud
 * of the slopes either side, with the crease showing and a short shadow where it stands up.
 *
 * This is what the joins of a real roof look like from above — Roi sent photographs of a dozen of them, and not one
 * has a line of bare timber anywhere on it. Drawing them as timber was what made the whole thing read as a room
 * seen from inside: four surfaces meeting at bright wooden trim is a ceiling, not a roof.
 */
function cap(g, o, a, b, half, base, rng) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  const d = [dx / l, dy / l], n = [-dy / l, dx / l];
  const pts = [
    [a[0] + n[0] * half, a[1] + n[1] * half], [b[0] + n[0] * half, b[1] + n[1] * half],
    [b[0] - n[0] * half, b[1] - n[1] * half], [a[0] - n[0] * half, a[1] - n[1] * half],
  ];
  g.save(); g.filter = `blur(${Math.max(1, half * 0.7)}px)`; g.translate(-LIGHT.at[0] * half * 1.1, -LIGHT.at[1] * half * 1.1);
  poly(g, pts); g.fillStyle = 'rgba(12,9,5,0.34)'; g.fill(); g.restore();
  poly(g, pts); g.fillStyle = mix(base, '#fff8e6', 0.12); g.fill();
  // The pieces it is made of, one after another along the join.
  const step = Math.max(half * 1.6, o.unit * 0.1);
  for (let at = step; at < l; at += step) {
    const p = [a[0] + d[0] * at, a[1] + d[1] * at];
    line(g, [[p[0] + n[0] * half, p[1] + n[1] * half], [p[0] - n[0] * half, p[1] - n[1] * half]], 'rgba(20,16,11,0.3)', o.ink * 0.7);
  }
  line(g, [pts[0], pts[1]], 'rgba(18,14,9,0.4)', o.ink * 0.95);
  line(g, [pts[3], pts[2]], 'rgba(18,14,9,0.4)', o.ink * 0.95);
  line(g, [[pts[0][0] + LIGHT.at[0] * half * 0.3, pts[0][1] + LIGHT.at[1] * half * 0.3], [pts[1][0] + LIGHT.at[0] * half * 0.3, pts[1][1] + LIGHT.at[1] * half * 0.3]], 'rgba(255,248,232,0.16)', o.ink * 0.9);
}

/** A timber lying along a line: the ridge, or a hip running down to a corner, or a thatch roll at the eave. */
function beam(g, o, a, b, half, colour = '#5b4526') {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, n = [-dy / l, dx / l];
  const pts = [[a[0] + n[0] * half, a[1] + n[1] * half], [b[0] + n[0] * half, b[1] + n[1] * half], [b[0] - n[0] * half, b[1] - n[1] * half], [a[0] - n[0] * half, a[1] - n[1] * half]];
  g.save(); g.filter = `blur(${Math.max(1, half * 0.5)}px)`; g.translate(-LIGHT.at[0] * half * 1.4, -LIGHT.at[1] * half * 1.4);
  poly(g, pts); g.fillStyle = 'rgba(12,9,5,0.4)'; g.fill(); g.restore();
  poly(g, pts); g.fillStyle = colour; g.fill();
  poly(g, pts); g.strokeStyle = 'rgba(16,11,6,0.7)'; g.lineWidth = o.ink * 1.1; g.stroke();
  line(g, [[a[0] + LIGHT.at[0] * half * 0.5, a[1] + LIGHT.at[1] * half * 0.5], [b[0] + LIGHT.at[0] * half * 0.5, b[1] + LIGHT.at[1] * half * 0.5]], 'rgba(244,232,206,0.16)', o.ink * 1.1);
}

/** What a roof can be covered with. `moss` is how readily that stuff takes it. */
export const ROOF_KINDS = Object.freeze({
  thatch: {
    label: 'Thatch', about: 'bundled reed, combed down the fall, thick at the eave',
    base: '#9a8040', grain: 0.09, moss: 1,
    face(g, rng, o, face, lit) {
      laid(g, rng, o, face, tonedBase(this.base, lit, o.faceTone), { piece: [0.3, 0.38], lap: 0.6, vary: 0.14, shape: bundle });
      const a = alongFace(face, 0, 0.02), b = alongFace(face, 1, 0.02);
      beam(g, o, a, b, o.unit * 0.045, '#6f5a24');
    },
  },
  tile: {
    label: 'Clay tile', about: 'courses of pantile, each lapping the one below',
    base: '#a85b33', grain: 0.07, moss: 0.7,
    face(g, rng, o, face, lit) { laid(g, rng, o, face, tonedBase(this.base, lit, o.faceTone), { piece: [0.2, 0.17], lap: 0.5, vary: 0.13, shape: pantile }); },
  },
  slate: {
    label: 'Slate', about: 'thin grey courses, cool and close',
    base: '#4e5358', grain: 0.08, moss: 0.5,
    face(g, rng, o, face, lit) { laid(g, rng, o, face, tonedBase(this.base, lit, o.faceTone), { piece: [0.16, 0.11], lap: 0.35, vary: 0.11, shape: flatPiece }); },
  },
  shingle: {
    label: 'Shingle', about: 'split wood, uneven and warm',
    base: '#7a5f39', grain: 0.1, moss: 0.9,
    face(g, rng, o, face, lit) { laid(g, rng, o, face, tonedBase(this.base, lit, o.faceTone), { piece: [0.22, 0.15], lap: 0.4, vary: 0.16, shape: (gg, c, t, r, oo) => flatPiece(gg, c, t, r, oo, oo.unit * 0.012) }); },
  },
  plank: {
    label: 'Planks', about: 'boards down the fall, for a shed or a lean-to',
    base: '#6b5538', grain: 0.1, moss: 0.8,
    face(g, rng, o, face, lit) { boards(g, rng, o, face, tonedBase(this.base, lit, o.faceTone), 0.22); },
  },
  lead: {
    label: 'Lead', about: 'sheet metal with standing seams: a hall, a temple',
    base: '#5c6066', grain: 0.08, moss: 0.3,
    face(g, rng, o, face) {
      const bays = acrossFace(face, o, 0.42, 3, 40); // a lead sheet is about two feet wide, whatever it is roofing
      for (let i = 1; i < bays; i++) {
        const p0 = alongFace(face, i / bays, 0), p1 = alongFace(face, i / bays, 1);
        line(g, [p0, p1], 'rgba(14,18,22,0.4)', o.ink * 1.6);
        line(g, [[p0[0] + LIGHT.at[0] * o.ink * 1.2, p0[1] + LIGHT.at[1] * o.ink * 1.2], [p1[0] + LIGHT.at[0] * o.ink * 1.2, p1[1] + LIGHT.at[1] * o.ink * 1.2]], 'rgba(244,246,250,0.16)', o.ink);
      }
    },
  },
  turf: {
    label: 'Turf', about: 'sod and grass growing on it: a longhouse, a dugout',
    base: '#4c5a2c', grain: 0.13, moss: 0,
    face(g, rng, o, face) {
      // Grass grows at the same density whatever it is growing on, so the blades are counted off the area.
      const blades = Math.max(40, Math.min(900, Math.round(faceArea(face) / (o.unit * o.unit) * 55)));
      for (let i = 0; i < blades; i++) {
        const p = alongFace(face, rng(), rng()), len = o.unit * (0.03 + rng() * 0.05), lean = (rng() - 0.5) * 0.6;
        line(g, [p, [p[0] + lean * len, p[1] - len]], rng() < 0.5 ? 'rgba(30,42,16,0.5)' : 'rgba(142,166,78,0.4)', o.ink * 0.6);
      }
    },
  },
  canvas: {
    label: 'Canvas', about: 'cloth over a frame, sagging between the poles',
    base: '#9a8a68', grain: 0.09, moss: 0,
    face(g, rng, o, face) {
      const bays = acrossFace(face, o, 1, 3, 30); // a pole every five feet or so, whatever the tent is over
      for (let i = 1; i < bays; i++) {
        const p0 = alongFace(face, i / bays, 0), p1 = alongFace(face, i / bays, 1);
        line(g, [p0, [(p0[0] + p1[0]) / 2 + (noise(i * 3, 2) - 0.5) * o.unit * 0.1, (p0[1] + p1[1]) / 2], p1], 'rgba(40,30,16,0.3)', o.ink * 1.1);
      }
    },
  },
});

export const ROOF_IDS = Object.freeze(Object.keys(ROOF_KINDS));
export const ROOF_CHOICES = Object.freeze(Object.entries(ROOF_KINDS).map(([id, r]) => Object.freeze({ id, label: r.label, about: r.about, base: r.base })));
/** The roof a building of this wall material would have, unless the GM says otherwise. */
export const roofFor = (material) => ({ timber: 'shingle', palisade: 'thatch', adobe: 'tile', dressed: 'slate', brick: 'tile', fieldstone: 'thatch', hewn: 'slate', natural: 'turf' }[material] ?? 'thatch');

// ---------------------------------------------------------------------------------------------------- weather

/**
 * Where a chimney stands on a roof (pure): along the ridge at `where` (0 one end, 1 the other, 0.5 the middle), or
 * at the peak of a pyramid or a cone. A scene wants this point as well as the picture — it is where the smoke comes
 * from, and Animater has drawn chimney smoke for a long while.
 */
export function chimneyAt(shape, where = 0.6) {
  if (shape?.peak) return [...shape.peak];
  const [a, b] = shape?.ridge ?? [[0, 0], [0, 0]], t = Math.max(0, Math.min(1, where));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** A chimney seen from above: a stack of brick or stone with the dark of the flue down the middle of it. */
function chimney(g, rng, o, at, stone) {
  const w = o.unit * 0.17, h = o.unit * 0.13;
  const box = [[at[0] - w, at[1] - h], [at[0] + w, at[1] - h], [at[0] + w, at[1] + h], [at[0] - w, at[1] + h]];
  g.save(); g.filter = `blur(${o.unit * 0.04}px)`; g.translate(-LIGHT.at[0] * o.unit * 0.1, -LIGHT.at[1] * o.unit * 0.1);
  poly(g, box); g.fillStyle = 'rgba(10,8,5,0.5)'; g.fill(); g.restore();
  poly(g, box); g.fillStyle = stone; g.fill();
  // Courses across it, and the grain of the brick.
  g.save(); poly(g, box); g.clip();
  for (let i = 1; i < 3; i++) line(g, [[at[0] - w, at[1] - h + (h * 2 * i) / 3], [at[0] + w, at[1] - h + (h * 2 * i) / 3]], 'rgba(16,10,6,0.4)', o.ink * 0.8);
  for (let i = 0; i < 60; i++) { g.fillStyle = rng() < 0.55 ? 'rgba(14,10,6,0.12)' : 'rgba(240,230,210,0.1)'; g.fillRect(at[0] - w + rng() * w * 2, at[1] - h + rng() * h * 2, 1, 1); }
  g.restore();
  // The flue: the dark hole down the middle, with soot round its lip.
  const flue = [[at[0] - w * 0.45, at[1] - h * 0.4], [at[0] + w * 0.45, at[1] - h * 0.4], [at[0] + w * 0.45, at[1] + h * 0.4], [at[0] - w * 0.45, at[1] + h * 0.4]];
  poly(g, flue); g.fillStyle = '#17120d'; g.fill();
  poly(g, flue); g.strokeStyle = 'rgba(12,9,6,0.8)'; g.lineWidth = o.ink * 2.2; g.stroke();
  poly(g, box); g.strokeStyle = INK; g.lineWidth = o.ink * 1.4; g.lineJoin = 'round'; g.stroke();
}

/** What the year and the weather put on a roof. */
function weather(g, rng, o, face, r, lit) {
  const pts = face.pts;
  if (o.wet > 0) {
    g.fillStyle = `rgba(8,10,14,${0.22 * o.wet})`; poly(g, pts); g.fill();
    for (let i = 0; i < 26 * o.wet; i++) {
      const p0 = alongFace(face, rng(), 0.1 + rng() * 0.8), len = o.unit * (0.06 + rng() * 0.12);
      const eave = alongFace(face, 0.5, 0), ridge = alongFace(face, 0.5, 1);
      const dx = ridge[0] - eave[0], dy = ridge[1] - eave[1], l = Math.hypot(dx, dy) || 1;
      line(g, [p0, [p0[0] - (dx / l) * len, p0[1] - (dy / l) * len]], `rgba(226,238,248,${(0.1 + rng() * 0.16) * (0.4 + lit * 0.6)})`, o.ink * 0.8);
    }
  }
  if (o.moss > 0 && r.moss > 0) {
    // Moss takes the shaded side and the courses near the eave, where the wet sits longest.
    const greens = ['#3f4a1c', '#55602a', '#6d7436', '#2a3214'], much = o.moss * r.moss * (1 - lit * 0.6);
    for (let i = 0; i < 90 * much; i++) {
      const p = alongFace(face, rng(), Math.min(1, Math.abs(noise(i * 1.7, 5) - 0.5) * 0.9)), rr = o.unit * (0.02 + rng() * 0.05), ring = [];
      g.globalAlpha = 0.3 + rng() * 0.35; g.fillStyle = greens[Math.floor(rng() * greens.length)];
      for (let k = 0; k <= 9; k++) { const a = (k / 9) * 6.283, w = 1 + (noise(Math.cos(a) * 2 + i, Math.sin(a) * 2) - 0.5) * 0.8; ring.push([p[0] + Math.cos(a) * rr * w, p[1] + Math.sin(a) * rr * w * 0.8]); }
      poly(g, ring); g.fill();
    }
    g.globalAlpha = 1;
  }
  if (o.leaves > 0) {
    // Fallen leaves gather where the roof holds them: along the eave, not on the pitch.
    const tints = ['#8a5218', '#b47a28', '#6a3a12', '#c49a36'];
    for (let i = 0; i < 70 * o.leaves; i++) {
      const p = alongFace(face, rng(), Math.min(0.35, rng() * rng())), rr = o.unit * (0.015 + rng() * 0.02);
      g.globalAlpha = 0.5 + rng() * 0.4; g.fillStyle = tints[Math.floor(rng() * tints.length)];
      g.beginPath(); g.ellipse(p[0], p[1], rr * 1.6, rr, rng() * 3, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
  }
  if (o.snow > 0) {
    // Snow lies deepest on the face the sun never reaches, and slides off the steep lit side.
    // The sun-facing slope loses it first, but not by so much that a roof is half bare while the ground beside it
    // is white over: at a full fall everything is under it, and the slopes differ on the way there and back.
    const much = o.snow * (1 - lit * 0.3);
    g.save(); poly(g, pts); g.clip();
    // It lies as a sheet, not as a scattering: a roof under snow is white with its tiles showing faintly through,
    // and it melts back up the slope from the eave rather than thinning out evenly. Drawn as a hundred and twenty
    // little blobs however big the roof was, it read as splashes of white paint (Roi: "does it look realistic to
    // you?" — it did not). The scattering is still here, but as the broken edge of the sheet rather than as all
    // the snow there is.
    // Where the snow has got back to, measured up from the eave. It goes from the ridge down, not from the eave
    // up: the slope over a heated room is warm and melts first, while the eave hangs out past the walls in the
    // cold and keeps its snow longest — which is why ice gathers there and not at the top.
    const melted = Math.min(1, much * 1.35);
    if (much > 0.08) {
      const edge = [];
      for (let k = 0; k <= 24; k++) {
        const t = k / 24, wobble = (noise(t * 5.5, 11) - 0.5) * 0.17 * (1 - much * 0.5);
        edge.push(alongFace(face, t, Math.max(0, Math.min(1, melted + wobble))));
      }
      const sheet = [...edge];
      for (let k = 24; k >= 0; k--) sheet.push(alongFace(face, k / 24, 0));
      poly(g, sheet); g.fillStyle = `rgba(238,243,250,${(0.52 + 0.4 * much).toFixed(3)})`; g.fill();
      // Where it has slid, the edge stands a little proud and casts its own small shadow down the slope.
      g.save(); g.filter = `blur(${Math.max(1, o.unit * 0.02)}px)`;
      line(g, edge.map(([x, y]) => [x - LIGHT.at[0] * o.unit * 0.02, y - LIGHT.at[1] * o.unit * 0.02]), 'rgba(150,166,190,0.5)', o.ink * 1.4);
      g.restore();
    }
    // Clumps below the line: what is left of it where it has gone, counted off the face rather than guessed.
    const loose = Math.max(6, Math.min(260, Math.round((faceArea(face) / (o.unit * o.unit)) * 7 * much * (1 - much * 0.65))));
    for (let i = 0; i < loose; i++) {
      // Above the line the snow has gone back to: that is where what is left of it is still clinging on.
      const p = alongFace(face, rng(), melted + (1 - melted) * rng()), rr = o.unit * (0.03 + rng() * 0.07), ring = [];
      for (let k = 0; k <= 10; k++) { const a = (k / 10) * 6.283, w = 1 + (noise(Math.cos(a) * 2.2 + i, Math.sin(a) * 2.2) - 0.5) * 0.9; ring.push([p[0] + Math.cos(a) * rr * w, p[1] + Math.sin(a) * rr * w * 0.72]); }
      poly(g, ring.map(([x, y]) => [x - LIGHT.at[0] * rr * 0.2, y - LIGHT.at[1] * rr * 0.2])); g.fillStyle = 'rgba(146,162,186,0.45)'; g.fill();
      poly(g, ring); g.fillStyle = 'rgba(236,241,248,0.9)'; g.fill();
    }
    g.restore();
  }
  if (o.soot > 0) {
    g.save(); g.filter = `blur(${o.unit * 0.1}px)`;
    for (let i = 0; i < 30 * o.soot; i++) {
      const p = alongFace(face, rng(), 0.5 + rng() * 0.5), rr = o.unit * (0.06 + rng() * 0.14);
      g.fillStyle = `rgba(16,13,11,${0.12 + rng() * 0.22 * o.soot})`; g.beginPath(); g.ellipse(p[0], p[1], rr, rr * 0.7, rng() * 3, 0, 6.28); g.fill();
    }
    g.restore();
  }
}

// ---------------------------------------------------------------------------------------------------- the picture

/**
 * A slope covered with a roofing picture (roof-cover.mjs) instead of courses painted piece by piece: laid from its
 * eave up, then turned toward or away from the light as the painted coverings are — into the roofing, not over it,
 * and more gently than they are, since a painted picture has shading of its own on every tile.
 */
function layCover(g, o, face, lit, faceTone) {
  const c = o.cover, at = coverCourses(face, c, o.unit);
  g.save(); g.rotate(at.rot);
  for (const y of at.rows) for (const x of at.cols) g.drawImage(c.image, x, y, at.w, at.h);
  g.restore();
  const turn = (Math.max(0, Math.min(1, Number(lit) || 0)) - 0.5) * 2 * faceTone;
  if (Math.abs(turn) > 0.004) {
    g.save(); g.globalCompositeOperation = turn > 0 ? 'soft-light' : 'multiply';
    g.fillStyle = turn > 0 ? `rgba(255,244,214,${Math.min(1, turn * 1.3).toFixed(3)})` : `rgba(18,16,26,${Math.min(1, -turn * 0.95).toFixed(3)})`;
    poly(g, face.pts); g.fill(); g.restore();
  }
}

/** One roof, drawn into `g` in the picture's own pixels. `shape` from hippedRoof, already relative to the picture. */
export function paintRoof(g, kind, shape, o) { return underLight(o?.lit, () => paintRoofLit(g, kind, shape, o)); }
function paintRoofLit(g, kind, shape, o) {
  // The covering wearing whatever colour it was painted in: `face` reaches for `this.base`, so a tinted copy of
  // the kind tints every slate laid from it without any of them knowing about it.
  // (A roof covered with a picture takes that picture's own colour for what is its own: its caps, what shows at its
  // joins. It is still the kind it was laid as for everything else — how readily moss takes to it, how it weathers.)
  const cover = o.cover?.image && o.cover.width > 0 && o.cover.height > 0 ? o.cover : null;
  const own = ROOF_KINDS[kind] ?? ROOF_KINDS.tile;
  const r = tintedKind(cover?.base ? { ...own, base: cover.base } : own, o.tint, o.tintMuch);
  const rng = seeded(o.seed ?? 9);
  // Its shadow on the ground, thrown away from the light: this is what puts it above the walls, and seen from
  // straight above it is very nearly the only thing that does. A hip roof and an empty room are the same four
  // shapes meeting at a middle line, so with no shadow clear of the eaves the eye is free to read the roof as a
  // box you are looking into (Roi: "it looks like the roof leans towards inwards rather than outwards"). It has
  // to land past the overhang to be seen at all, which at 0.42 against an overhang of 0.42 it did not.
  const reach = o.unit * (Number.isFinite(Number(o.shadowReach)) ? Number(o.shadowReach) : ROOF_SHADOW_REACH);
  g.save(); g.filter = `blur(${Math.max(3, o.unit * 0.1)}px)`; g.translate(-LIGHT.at[0] * reach, -LIGHT.at[1] * reach);
  // (As dark as the walls' cast shadows are at full sun and no darker: this one stands in for those where nothing
  // is cast, and at 0.45 it was the darkest shadow on the map.)
  poly(g, shape.eave); g.fillStyle = 'rgba(10,8,5,0.35)'; g.fill(); g.restore();

  const faceTone = Math.max(0, Math.min(1, Number.isFinite(Number(o.faceTone)) ? Number(o.faceTone) : ROOF_FACE_TONE));
  const eaveLight = Math.max(0, Math.min(1, Number.isFinite(Number(o.eaveLight)) ? Number(o.eaveLight) : ROOF_EAVE_LIGHT));
  for (const face of shape.faces) {
    const lit = litness(face.away);
    // The face's own colour, already turned toward or away from the light. For lead, turf and canvas this is the
    // material — they draw onto the face rather than covering it — and for the rest it is what shows between the
    // pieces laid on top, which are toned to match.
    poly(g, face.pts); g.fillStyle = tonedBase(r.base, lit, faceTone); g.fill();
    g.save(); poly(g, face.pts); g.clip();
    // How the slope falls away from the ridge. Darkening the eave puts the dark at the outer rim, which is how you
    // shade the inside of a bowl; `eaveLight` turns it the other way, catching the outer edge where it stands up
    // off the wall and leaving the shade up against the ridge.
    const eaveMid = alongFace(face, 0.5, 0), ridgeMid = alongFace(face, 0.5, 1);
    const fall = g.createLinearGradient(eaveMid[0], eaveMid[1], ridgeMid[0], ridgeMid[1]);
    if (eaveLight > 0) {
      fall.addColorStop(0, `rgba(255,248,230,${(0.26 * eaveLight).toFixed(3)})`);
      fall.addColorStop(0.22, 'rgba(255,248,230,0)');
      fall.addColorStop(0.82, 'rgba(10,8,4,0)');
      fall.addColorStop(1, `rgba(10,8,4,${(0.22 * eaveLight).toFixed(3)})`);
    } else { fall.addColorStop(0, 'rgba(10,8,4,0.2)'); fall.addColorStop(0.3, 'rgba(10,8,4,0)'); }
    g.fillStyle = fall; poly(g, face.pts); g.fill();
    const c = face.pts.reduce((s, p) => [s[0] + p[0] / face.pts.length, s[1] + p[1] / face.pts.length], [0, 0]);
    const reach = Math.max(...face.pts.map(([x, y]) => Math.hypot(x - c[0], y - c[1])));
    for (let i = 0; i < Math.min(2200, reach * reach * 0.35); i++) {
      g.fillStyle = rng() < 0.55 ? `rgba(14,12,9,${r.grain})` : `rgba(240,235,222,${r.grain * 0.7})`;
      g.fillRect(c[0] + (rng() - 0.5) * reach * 2, c[1] + (rng() - 0.5) * reach * 2, 1, 1);
    }
    if (cover) layCover(g, { ...o, cover }, face, lit, faceTone); else r.face(g, rng, o, face, lit);
    weather(g, rng, o, face, r, lit);
    g.restore();
    poly(g, face.pts); g.strokeStyle = 'rgba(16,13,9,0.35)'; g.lineWidth = o.ink * 0.9; g.stroke();
  }
  // How the joins are finished: capped in the roof's own stuff as a real roof is, or in the timbers it used to be.
  const hip = o.unit * 0.04, ridgeHalf = o.unit * 0.055;
  const capped = o.capped !== false;
  if (capped) {
    const base = tonedBase(r.base, 0.5, 0);
    const join = (a, b, half) => cap(g, o, a, b, half, base, rng);
    if (shape.peak) {
      for (const corner of shape.eave) join(corner, shape.peak, hip * (shape.round ? 0.8 : 1));
      g.beginPath(); g.arc(shape.peak[0], shape.peak[1], ridgeHalf * 1.05, 0, 6.283);
      g.fillStyle = mix(r.base, '#fff8e6', 0.16); g.fill();
      g.strokeStyle = 'rgba(18,14,9,0.45)'; g.lineWidth = o.ink; g.stroke();
    } else if (shape.shed) {
      join(shape.ridge[0], shape.ridge[1], ridgeHalf);
    } else if (shape.gable) {
      const [a, b] = shape.ridge;
      if (shape.along) { join(shape.eave[0], shape.eave[3], hip); join(shape.eave[1], shape.eave[2], hip); }
      else { join(shape.eave[0], shape.eave[1], hip); join(shape.eave[3], shape.eave[2], hip); }
      join(a, b, ridgeHalf);
    } else {
      for (const [i, corner] of shape.eave.entries()) join(corner, shape.ridge[i === 0 || i === 3 ? 0 : 1], hip);
      join(shape.ridge[0], shape.ridge[1], ridgeHalf);
    }
  } else if (shape.peak) {
    // A pyramid or a cone: a hip from every corner up to the point, and a cap where they meet.
    for (const corner of shape.eave) beam(g, o, corner, shape.peak, hip * (shape.round ? 0.8 : 1));
    g.beginPath(); g.arc(shape.peak[0], shape.peak[1], ridgeHalf * 1.1, 0, 6.283); g.fillStyle = '#5b4526'; g.fill();
    g.strokeStyle = 'rgba(16,11,6,0.7)'; g.lineWidth = o.ink; g.stroke();
  } else if (shape.shed) {
    // A lean-to: one timber along its high side, and nothing else to frame.
    beam(g, o, shape.ridge[0], shape.ridge[1], ridgeHalf);
  } else if (shape.gable) {
    // A gable: the barge boards down each upright end, then the ridge over them.
    const [a, b] = shape.ridge;
    if (shape.along) { beam(g, o, shape.eave[0], shape.eave[3], hip); beam(g, o, shape.eave[1], shape.eave[2], hip); }
    else { beam(g, o, shape.eave[0], shape.eave[1], hip); beam(g, o, shape.eave[3], shape.eave[2], hip); }
    beam(g, o, a, b, ridgeHalf);
  } else {
    for (const [i, corner] of shape.eave.entries()) beam(g, o, corner, shape.ridge[i === 0 || i === 3 ? 0 : 1], hip);
    beam(g, o, shape.ridge[0], shape.ridge[1], ridgeHalf);
  }
  // (What the building hangs out for a feast day is not painted here. It swings in the wind and the lanterns
  // light up at dusk, and this picture is baked once — so the dressing is drawn live by painted-dressing.mjs,
  // off the roof's own eave ring.)
  // A chimney stands on the roof, over everything else it is made of.
  if (o.chimney) chimney(g, rng, o, chimneyAt(shape, o.chimneyAt ?? 0.6), o.chimney === "stone" ? "#7a776e" : "#73574a");
  // The eave: the gutter shadow just inside it, then a firm edge all round.
  g.save(); poly(g, shape.eave); g.clip();
  poly(g, shape.eave); g.strokeStyle = 'rgba(14,11,7,0.35)'; g.lineWidth = o.unit * 0.07; g.stroke();
  g.restore();
  poly(g, shape.eave); g.strokeStyle = INK; g.lineWidth = o.ink * 1.6; g.lineJoin = 'round'; g.stroke();
}

/**
 * One roof's picture over a room's box, in scene pixels. Returns { canvas, box } — the box being where to lay it.
 */
export function paintRoofPicture(room, kind, look = {}, make = defaultCanvas, most = 2048) {
  if (!room || !(room.w > 0) || !(room.h > 0)) return null;
  const grid = look.grid ?? 100, over = grid * (look.overhang ?? ROOF_OVERHANG);
  const form = ROOF_FORMS[look.form] ? look.form : formFor(room, { grid });
  const shape = roofShape(form, room.x, room.y, room.w, room.h, over, look.high);
  // Room for the shadow it throws, beyond the eaves.
  const pad = Math.ceil(grid * 0.6);
  const box = { x: shape.box.x - pad, y: shape.box.y - pad, w: shape.box.w + pad * 2, h: shape.box.h + pad * 2 };
  const k = Math.min(Math.max(1, Number(look.sharp) || PICTURE_SHARP), most / Math.max(box.w, box.h, 1));
  const canvas = make(Math.max(1, Math.ceil(box.w * k)), Math.max(1, Math.ceil(box.h * k)));
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.scale(k, k); g.translate(-box.x, -box.y);
  paintRoof(g, kind, shape, {
    unit: grid, ink: Math.max(0.7, grid / 90), seed: look.seed ?? 9,
    snow: look.snow ?? 0, moss: look.moss ?? 0, soot: look.soot ?? 0, wet: look.wet ?? 0, leaves: look.leaves ?? 0,
    chimney: look.chimney ?? null, chimneyAt: look.chimneyAt, lit: look.lit ?? null,
    faceTone: look.faceTone, shadowReach: look.shadowReach, eaveLight: look.eaveLight, capped: look.capped, tint: look.tint ?? null, tintMuch: look.tintMuch, cover: look.cover ?? null,
  });
  // Where the smoke comes from, in scene pixels: the scene's own chimney smoke wants this.
  return { canvas, box, scale: k, form, chimney: look.chimney ? chimneyAt(shape, look.chimneyAt ?? 0.6) : null };
}
