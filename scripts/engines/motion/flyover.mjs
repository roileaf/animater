// Something flies over: a GM's moment. A great shadow crosses the map in the creature's shape, the air under it bends
// the trees (gusts.mjs), the animals bolt, its wings are heard, and it may come down and stand there. Pure: where it
// is, how its shadow looks, how its wings beat, the drawn shapes that stand in for art with no outline, and where its
// token is put. The drawing is flyover-draw.mjs; the sending, the sounds and the token are main.mjs.

import { UNDERGROUND_SOUNDS } from './underground-sounds.mjs';

export const FLYOVER_MESSAGE = 'flyover';
// What a landing is made of, besides its thud (Roi, 2026-11-25: "we need more of a BOOM when the creature lands, not
// just thud, maybe use some of the cave-in sounds, combine it with something else"). All already shipped and
// auditioned: a blast in the open, slowed until it is a boom with no crack left in it, and a cave-in's roar under it.
const PROPS = 'modules/animater/assets/sounds/props';
export const LANDING_BOOMS = Object.freeze([`${PROPS}/explosion/tannerite-forest-530162.ogg`, `${PROPS}/explosion/tannerite-tree-530163.ogg`]);
/**
 * The sounds of a landing over its thud (pure): [{ file, delay ms, rate, volume, lowpass }]. The boom at once, slow
 * and dark; the ground giving under it a moment later. `weight`: the landing's (a step heavier than the creature: 5 a
 * Huge one, 6 a Gargantuan), which makes it lower, longer and louder. `seed`: which recordings.
 */
export function landingBoom({ weight = 5, seed = 0 } = {}) {
  const big = weight >= 6, n = Math.abs(Math.trunc(Number(seed) || 0)), roar = UNDERGROUND_SOUNDS.caveIn;
  return [
    { file: LANDING_BOOMS[n % LANDING_BOOMS.length], delay: 0, rate: big ? 0.5 : 0.62, volume: 1, lowpass: 650 },
    { file: roar[n % roar.length], delay: 70, rate: big ? 0.7 : 0.82, volume: big ? 0.6 : 0.45, lowpass: 1500 },
  ];
}
export const FLYOVER_SHAPES = ['dragon', 'bird', 'bat', 'insect', 'wingless'];
// Aloft its shadow is drawn bigger than the creature, the more the higher, and comes down to its true size as it lands
// (Roi's call, 2026-11-25: "it should start big and shrink as it touches down"; not what the sun would really throw).
export const ALOFT = Object.freeze({ low: 2, high: 2.6 });
// How fast it flies, in squares a second.
const SPEED = { low: 5.7, high: 7.4 };
// Which way a picture's creature is drawn facing, as an angle on the map.
const FACE = { down: Math.PI / 2, up: -Math.PI / 2, left: Math.PI, right: 0 };
// After it lands the moment lasts this much longer, in seconds: the landing itself.
const LANDING_S = 1.6;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = (v, among, or) => (among.includes(v) ? v : or);
const text = (v, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

/** A flyover as asked, cleaned (pure); null when it names no place. Lengths in map pixels, `squares` the creature's true width. */
export function flyoverCall(raw) {
  const x = Number(raw?.x), y = Number(raw?.y);
  if (!raw || typeof raw !== 'object' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const scale = Number(raw.artScale);
  return {
    x, y, angle: Number.isFinite(Number(raw.angle)) ? Number(raw.angle) : 0,
    squares: clamp(Number(raw.squares) || 3, 0.5, 12), artScale: scale >= 0.2 && scale <= 4 ? scale : 1,
    shape: pick(raw.shape, FLYOVER_SHAPES, 'dragon'), art: text(raw.art, 512), faces: pick(raw.faces, Object.keys(FACE), 'down'), spread: raw.spread !== false,
    height: pick(raw.height, ['low', 'high'], 'low'), pass: pick(raw.pass, ['straight', 'circle', 'land'], 'straight'),
    wings: raw.wings !== false, voice: text(raw.voice, 200), actor: text(raw.actor, 200), turn: raw.turn !== false,
  };
}

/** How far off it starts, in pixels: beyond the edge of a map `rect` { width, height } wherever the spot is on it. */
export const flyoverReach = (rect, grid = 100) => Math.hypot(Number(rect?.width) || 0, Number(rect?.height) || 0) * 0.7 + grid * 4;

/**
 * Where it is `t` seconds in (pure): { x, y, heading, down 0 aloft – 1 on the ground, push how hard it blows, landed, done }.
 * Straight: across the spot and on. Circle: in, once round the spot, and on. Land: slowing to the spot, coming down
 * over the last of the way, and staying there.
 */
export function flyoverPlace(call, t, { grid = 100, reach = 2000 } = {}) {
  const speed = SPEED[call.height] * grid, far = Math.max(0, t) * speed, c = Math.cos(call.angle), s = Math.sin(call.angle);
  const from = { x: call.x - c * reach, y: call.y - s * reach }, on = (d) => ({ x: from.x + c * d, y: from.y + s * d });
  if (call.pass === 'land') {
    const k = Math.min(1, far / reach), landed = k >= 1, down = landed ? 1 : clamp((k - 0.55) / 0.45, 0, 1);
    return { ...(landed ? { x: call.x, y: call.y } : on(reach * (1 - (1 - k) * (1 - k)))), heading: call.angle, down, push: 1 + down * 0.6, landed, done: far > reach + speed * LANDING_S };
  }
  if (call.pass === 'circle') {
    const R = call.squares * grid, inLen = Math.max(0, reach - R), round = Math.PI * 2 * R, side = call.angle + Math.PI / 2;
    const ox = call.x - c * R + Math.cos(side) * R, oy = call.y - s * R + Math.sin(side) * R;
    if (far < inLen) return { ...on(far), heading: call.angle, down: 0, push: 1, landed: false, done: false };
    if (far < inLen + round) { const a = (far - inLen) / R, th = side + Math.PI + a; return { x: ox + Math.cos(th) * R, y: oy + Math.sin(th) * R, heading: call.angle + a, down: 0, push: 1, landed: false, done: false }; }
    const out = far - inLen - round;
    return { x: call.x - c * R + c * out, y: call.y - s * R + s * out, heading: call.angle, down: 0, push: 1, landed: false, done: out > reach * 1.4 };
  }
  return { ...on(far), heading: call.angle, down: 0, push: 1, landed: false, done: far > reach * 2 };
}

/** When it touches down, in seconds from its start (pure); null for a pass that does not land. */
export const flyoverLandsAt = (call, { grid = 100, reach = 2000 } = {}) => (call.pass === 'land' ? reach / (SPEED[call.height] * grid) : null);

/**
 * How its shadow looks at a place (pure): { scale times its true size, blur and offset in squares, alpha, fold 0-1 }.
 * Big aloft; landing, it comes down to its own size, slides in under the creature and draws its wings in.
 */
export function flyoverLook(call, place) {
  const d = clamp(Number(place?.down) || 0, 0, 1), high = call.height === 'high', up = high ? 1 - d : 0;
  return {
    scale: 1 + (ALOFT[call.height] - 1) * Math.pow(1 - d, 1.6),
    blur: (5 + 8 * up - (high ? 0 : 3 * d)) / 70,
    offset: ((26 + 44 * up) * (1 - d)) / 70,
    alpha: 0.78 - 0.2 * up + 0.1 * d,
    fold: d,
  };
}

/** Its wings now (pure): { beat -1..1, count of down-strokes so far }; slower the bigger it is, quicker from high up. */
export function flyoverBeat(call, t) {
  const turns = Math.max(0, t) * ((call.height === 'high' ? 5 : 4) / Math.sqrt(call.squares / 3));
  return { beat: Math.sin(turns), count: Math.floor(turns / (Math.PI * 2)) };
}

/** Its weight as a step's is counted (movement-feel.mjs stepWeight), from how many squares wide it is: 3 Large, 4 Huge, 5 Gargantuan. */
export const flyoverWeight = ({ squares = 3 } = {}) => (squares < 1.5 ? 2 : squares < 2.5 ? 3 : squares < 3.5 ? 4 : 5);

/** The gust it drags along (pure): { strength 0-1, width, length in pixels }. Weaker from high up, harder as it comes down to land. */
export function flyoverGust(call, place, grid = 100) {
  const base = call.squares >= 3.5 ? 1 : call.squares >= 2.5 ? 0.6 : call.squares >= 1.5 ? 0.4 : 0.3, wide = Math.max(call.squares * grid, grid * 2);
  return { strength: +Math.min(1, base * (call.height === 'high' ? 0.45 : 1) * (Number(place?.push) || 1)).toFixed(3), width: wide * 1.2, length: wide * 3 };
}

const INSECTS = /\b(?:wasps?|bees?|hornets?|dragonfl(?:y|ies)|moths?|butterfl(?:y|ies)|mosquito(?:es)?|flies|locusts?|mantis|beetles?|ankhegs?)\b/i;
const DRAGONS = /\b(?:dragons?|drakes?|wyverns?|wyrms?|linnorms?|dragonets?)\b/i;
const BIRDS = /\b(?:rocs?|eagles?|hawks?|owls?|ravens?|crows?|birds?|griffons?|griffins?|hippogriffs?|phoenix(?:es)?|harp(?:y|ies)|pegas(?:us|i)|vultures?|falcons?|thunderbirds?)\b/i;
const BATS = /\b(?:bats?|gargoyles?|imps?|succub(?:us|i)|erinyes|balors?|vrocks?|demons?|devils?|fiends?|nightgaunts?|chimeras?)\b/i;

/** The drawn shape that suits a creature (pure), from its name, its traits and how it flies (creature-gait.mjs creatureFlight). */
export function shapeFor({ name = '', traits = [], flight = null } = {}) {
  const has = (...t) => t.some((x) => (traits ?? []).includes(x));
  if (INSECTS.test(name)) return 'insect';
  if (has('dragon') || DRAGONS.test(name)) return 'dragon';
  if (BIRDS.test(name)) return 'bird';
  if (has('fiend', 'demon', 'devil') || BATS.test(name)) return 'bat';
  return flight === 'flight' ? 'wingless' : 'dragon';
}

// A path of straight lines and curves, kept as flat x,y pairs.
const path = () => {
  const p = []; let at = [0, 0];
  const api = {
    move(x, y) { at = [x, y]; p.push(x, y); return api; }, line(x, y) { at = [x, y]; p.push(x, y); return api; },
    quad(cx, cy, x, y) { const [x0, y0] = at; for (let i = 1; i <= 6; i++) { const k = i / 6, m = 1 - k; p.push(m * m * x0 + 2 * m * k * cx + k * k * x, m * m * y0 + 2 * m * k * cy + k * k * y); } at = [x, y]; return api; },
    get points() { return p; },
  };
  return api;
};
const oval = (x, y, rx, ry, turn = 0) => { const p = [], c = Math.cos(turn), s = Math.sin(turn); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, px = Math.cos(a) * rx, py = Math.sin(a) * ry; p.push(x + px * c - py * s, y + px * s + py * c); } return p; };

const DRAWN = {
  // A long neck and tail, two wings with scalloped trailing edges.
  dragon(w) { return [path().move(1.25, 0).quad(1, -0.09, 0.72, -0.07).quad(0.5, -0.16, 0.3, -0.15).line(0.34, -0.5 * w).quad(0.2, -1.1 * w, -0.18, -1.38 * w)
    .quad(-0.18, -1.05 * w, -0.36, -0.98 * w).quad(-0.24, -0.74 * w, -0.44, -0.62 * w).quad(-0.3, -0.4 * w, -0.46, -0.2).quad(-0.9, -0.1, -1.5, 0).quad(-0.9, 0.1, -0.46, 0.2)
    .quad(-0.3, 0.4 * w, -0.44, 0.62 * w).quad(-0.24, 0.74 * w, -0.36, 0.98 * w).quad(-0.18, 1.05 * w, -0.18, 1.38 * w).quad(0.2, 1.1 * w, 0.34, 0.5 * w)
    .line(0.3, 0.15).quad(0.5, 0.16, 0.72, 0.07).quad(1, 0.09, 1.25, 0).points]; },
  // Broad feathered wings with fingered tips, a short neck, a fanned tail.
  bird(w) { return [path().move(0.62, 0).quad(0.5, -0.1, 0.3, -0.1).line(0.3, -0.3 * w).quad(0.34, -0.95 * w, 0.04, -1.38 * w).line(-0.05, -1.2 * w).line(-0.13, -1.32 * w).line(-0.18, -1.13 * w)
    .line(-0.27, -1.2 * w).line(-0.3, -1.0 * w).quad(-0.34, -0.5 * w, -0.26, -0.13).line(-0.58, -0.1).line(-0.98, -0.3).quad(-0.86, 0, -0.98, 0.3).line(-0.58, 0.1).line(-0.26, 0.13)
    .quad(-0.34, 0.5 * w, -0.3, 1.0 * w).line(-0.27, 1.2 * w).line(-0.18, 1.13 * w).line(-0.13, 1.32 * w).line(-0.05, 1.2 * w).line(0.04, 1.38 * w).quad(0.34, 0.95 * w, 0.3, 0.3 * w)
    .line(0.3, 0.1).quad(0.5, 0.1, 0.62, 0).points]; },
  // Skin stretched between long fingers: pointed tips, hollow curves between them, ears, hardly any tail.
  bat(w) { return [path().move(0.52, 0).line(0.44, -0.07).line(0.54, -0.17).line(0.3, -0.12).line(0.32, -0.5 * w).line(0.14, -1.34 * w).quad(0, -0.92 * w, -0.28, -1.12 * w)
    .quad(-0.2, -0.76 * w, -0.52, -0.72 * w).quad(-0.34, -0.42 * w, -0.46, -0.13).line(-0.74, 0).line(-0.46, 0.13).quad(-0.34, 0.42 * w, -0.52, 0.72 * w).quad(-0.2, 0.76 * w, -0.28, 1.12 * w)
    .quad(0, 0.92 * w, 0.14, 1.34 * w).line(0.32, 0.5 * w).line(0.3, 0.12).line(0.54, 0.17).line(0.44, 0.07).points]; },
  // Four narrow wings, a head, a thorax and a long thin tail.
  insect(w) { const out = [oval(0.56, 0, 0.13, 0.12), oval(0.22, 0, 0.2, 0.11), oval(-0.5, 0, 0.56, 0.065)];
    for (const k of [-1, 1]) out.push(oval(0.34, k * 0.6 * w, 0.11, 0.62 * w, k * 0.5), oval(-0.06, k * 0.5 * w, 0.1, 0.5 * w, -k * 0.5));
    return out; },
  // No wings: a long body winding as it goes (a great worm, a serpent of the air).
  wingless(w, t) { const N = 28, left = [], right = [];
    for (let i = 0; i <= N; i++) { const u = i / N, grow = 0.25 + 0.75 * u, x = 1.2 - 2.5 * u, y = 0.26 * Math.sin(u * 7.6 - t * 3) * grow, wide = 0.03 + 0.13 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.55);
      const dy = (0.26 * 7.6 / N) * Math.cos(u * 7.6 - t * 3) * grow, dx = -2.5 / N, n = Math.hypot(dx, dy) || 1; left.push(x - (dy / n) * wide, y + (dx / n) * wide); right.unshift(x + (dy / n) * wide, y - (dx / n) * wide); }
    // (Down one side and back up the other: `right` was built back to front, a pair at a time.)
    return [[...left, ...right], oval(1.2, 0, 0.12, 0.09)]; },
};

/**
 * A drawn shape's outlines (pure): closed polygons as flat x,y pairs, heading along +x, a body length about 1.
 * `span` how far its wings are out (1 full, about 0.72 drawn in on the beat); `t` seconds, for the one that winds.
 */
export function shapePolygons(shape, span = 1, t = 0) { return (DRAWN[shape] ?? DRAWN.dragon)(clamp(Number(span) || 1, 0.3, 1.2), Number(t) || 0); }

// The middle of a creature's art that is its body, a share of its half-width: only what lies outside it is wing.
const BODY = 0.2;
/**
 * Where a column of a creature's art goes when its sides are pulled out as wings (pure). `u`: -1 one side, 0 its
 * spine, 1 the other. Returns { at: where that column is drawn, sweep: how far it is carried along its length, a
 * share of the art's size }. `beat` -1..1; `fold` 0-1: drawn in as it lands (1: the art as it is).
 */
export function spreadColumn(u, { beat = 0, fold = 0 } = {}) {
  const open = 1 - clamp(fold, 0, 1), reach = Math.abs(u), spread = 1 + (0.25 + 0.3 * (0.5 + 0.5 * beat)) * open;
  if (reach < BODY) return { at: u, sweep: 0 };
  const out = (reach - BODY) / (1 - BODY);
  return { at: Math.sign(u) * (BODY + (reach - BODY) * spread), sweep: (0.13 * -beat * open * out * out) || 0 };
}

/** How far to turn a picture drawn facing `faces` so it heads along `angle`, in radians (the shadow, and the token). */
export const artTurn = ({ angle = 0, faces = 'down' } = {}) => angle - (FACE[faces] ?? FACE.down);
/** The same for a token's rotation, in whole degrees 0-359. */
export const tokenRotation = (call) => ((Math.round((artTurn(call) * 180) / Math.PI) % 360) + 360) % 360;
/** The top-left corner of a token `size` { width, height } squares, centred on a spot and snapped to the grid. */
export const tokenCorner = (spot, size, grid = 100) => ({ x: Math.round((spot.x - ((size?.width ?? 1) * grid) / 2) / grid) * grid, y: Math.round((spot.y - ((size?.height ?? 1) * grid) / 2) / grid) * grid });
