// What a carrier looks like. A carrier is an ordinary token (carriers.mjs says why), so by itself it wears whatever picture
// the GM gave it. This picks the painted vehicle it wears instead: which of the baked sets (an open wagon behind its horse,
// a hand cart, a covered wagon), which of the three coats, which way it points, and which frame of the wheels' turn it is
// on for how far it has rolled. The frames come from assets/animals/vehicles.webp, baked from tools/fx-gallery the same way
// the farm animals are.
//
// Pure: no Foundry, no canvas, no PIXI. The caller says where the token is and how big the grid is.

export const LOOK = "carrierLook";

// The baked sets, and what the select offers. "" is the GM saying: work it out from the kind.
export const CARRIER_LOOKS = Object.freeze({
  "": "Automatic",
  wagon: "Open wagon and horse",
  tilt: "Covered wagon and horse",
  cart: "Hand cart",
  sled: "Sled",
  boat: "Rowing boat",
  horse: "Riding horse",
  none: "Token picture",
});
const BY_KIND = Object.freeze({ wagon: "wagon", cart: "cart", sled: "sled", boat: "boat", mount: "horse" });

// Where each set's frames live and what they are called. The vehicles are baked on their own (the wagon without the
// horse that pulls it: one picture of both was seven metres wide and left the wagon too few pixels to bear zooming
// in on), and the horses come from the farm sheet, which has had draught horses and riding horses in it all along —
// so a wagon's team walks its own stride, each casts its own shadow over its own ground, and a token set to Mount
// wears a horse without anything new being baked at all.
// The vehicles are painted, not baked: carrier-paint.mjs draws them with the decorations' own tools at whatever size
// the map asks for, so they are as crisp zoomed in as on the table (`paint`, with `span` the feet its picture holds).
// A boat wears the decorations' own rowboat (`decor`). Only the horses are still baked frames, from the farm sheet,
// because the animals are their own system.
export const SETS = Object.freeze({
  wagon: Object.freeze({ paint: "wagon", span: 20, team: "draughtHorses" }),
  tilt: Object.freeze({ paint: "tilt", span: 20, team: "draughtHorses" }),
  cart: Object.freeze({ paint: "cart", span: 14, team: "" }),
  // A sled is not pulled from shafts by one big animal: it is roped to a pack (Roi: "give it 2-4 wolves that pull?").
  // The wolves come from the field sheet, which has had them trotting and running all along, so nothing new is baked;
  // how many are in this sled's team is settled once by its own id and never changes under it.
  sled: Object.freeze({ paint: "sled", span: 11, team: "wolf", group: "field", moving: "trot", still: "rest", frames: 8, pack: [2, 4], ahead: 8, apart: 3.5, rows: 4.5, feet: 5, rope: true, hitch: Object.freeze({ ahead: 2.19, across: 1.47 }) }),
  boat: Object.freeze({ decor: "rowboat", span: 13, team: "" }),
  horse: Object.freeze({ group: "farm", folder: "horses", still: "idle", moving: "walk", team: "" }),
});
/** Whether a set is painted at the size it is drawn rather than taken from a baked sheet. */
export const isPainted = (set) => !!(SETS[set]?.paint || SETS[set]?.decor);
// A horse standing still is not a statue: four baked moments of its standing round, each held about this long, so it
// shifts its weight and puts its head down while it waits.
export const IDLE_FRAMES = 6;
const IDLE_HOLD = 1400;
/** Which frame of a standing horse's round is showing at `now` (ms), steady per carrier so two do not breathe as one. */
export const idleFrame = (now = 0, seed = "") =>
  (Math.floor((Number(now) || 0) / IDLE_HOLD) + coatOf(`idle:${seed}`)) % IDLE_FRAMES;
// The frames where its head is up (the first two of the round): where a call comes from, since a horse with its nose
// in the grass does not neigh.
export const HEAD_UP = 2;
export const headUp = (frame = 0) => (Number(frame) || 0) < HEAD_UP;
// How far ahead of the vehicle's middle the team walks, in feet. The shafts reach a metre past the bed, so the horse
// stands with its hindquarters over their tips and they run up alongside it: set further out, it floated ahead of the
// wagon with a clear gap and nothing joining the two.
const TEAM_AHEAD = 12;
// How long a team animal is drawn, nose to tail, in feet, where its frame has no size baked into it: a draught horse.
const TEAM_FEET = 10;
const TEAM_FRAMES = 4;
export const COATS = 3;
export const ROLL_FRAMES = 4;

/** Which baked set a carrier wears: what the GM chose, else the one its kind suggests, else none. */
export function lookFor(kind, look = "") {
  if (look === "none") return "";
  if (look && look in CARRIER_LOOKS) return look;
  return BY_KIND[kind] ?? "";
}

/** Which of the three coats this carrier wears: steady for one token, spread over several, so no two stand alike. */
export function coatOf(id = "") {
  let h = 2166136261;
  for (let i = 0; i < String(id).length; i++) { h ^= String(id).charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % COATS;
}

// How far a wheel carries the wagon in one turn: a cart wheel about 1.4 m across, so about four and a half feet — near
// enough one square of a five-foot grid. Four baked frames share that turn.
const TURN = 1;

/**
 * Which frame of the wheels' turn a carrier that has rolled `travelled` (in grid squares) is showing, and whether it is
 * rolling at all. Standing still it shows its standing frame, where the horse has both front feet down.
 */
export function rollPhase(travelled = 0, moving = true) {
  if (!moving) return null;
  const turn = ((Number(travelled) || 0) / TURN) % 1;
  return Math.floor(((turn % 1) + 1) % 1 * ROLL_FRAMES) % ROLL_FRAMES;
}

/** Which sheet a set's frames are baked in. */
export const groupOf = (set) => SETS[set]?.group ?? "vehicles";
/** The path of one frame of a set: its standing frame, or one of the frames of its round. */
export const framePath = (set, coat = 0, phase = null, still = 0) => {
  const own = SETS[set];
  const folder = own?.folder ?? set;
  if (!own) return phase === null ? `${folder}/${coat}/stand` : `${folder}/${coat}/roll/${phase}`;
  if (phase !== null) return `${folder}/${coat}/${own.moving}/${phase}`;
  // A standing round has frames of its own; a standing pose is the one frame.
  return own.still === "idle" ? `${folder}/${coat}/idle/${still}` : `${folder}/${coat}/${own.still}`;
};
/** How many pull this carrier: one in the shafts, or a pack of as many as its set allows, settled by the carrier's id. */
export function packSize(set, seed = "") {
  const pack = SETS[set]?.pack;
  if (!pack) return SETS[set]?.team ? 1 : 0;
  const [least, most] = pack;
  return least + (coatOf(`pack:${seed}`) % (most - least + 1));
}
/**
 * What pulls this carrier, as a list of `{ group, path, ahead, across }` — `ahead` and `across` in feet from the
 * vehicle's middle — or null for the ones nothing pulls. They run their own stride rather than the wheels', so their
 * legs keep their own time, and a pack is strung out two abreast with each animal a little out of step with the next:
 * four wolves moving as one animal is a toy, not a team.
 */
export function teamStep(set, coat = 0, rolled = 0, moving = true, now = 0, seed = "") {
  const spec = SETS[set];
  if (!spec?.team) return null;
  const group = spec.group ?? "farm", frames = spec.frames ?? TEAM_FRAMES;
  const ahead = spec.ahead ?? TEAM_AHEAD, count = packSize(set, seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    // Each one takes its own coat and its own place in the stride, so the pack does not move as one body.
    const mine = (coat + i) % COATS, offset = i / Math.max(1, count);
    const n = moving ? Math.floor(((((rolled / 1.4) + offset) % 1) + 1) % 1 * frames) % frames : null;
    // Standing, it does not freeze: a horse goes round its standing round, a wolf waits on its feet.
    const path = n === null
      ? `${spec.team}/${mine}/${spec.still ?? "idle"}/${spec.still === "rest" ? 0 : idleFrame(now, `${seed}:${i}`)}`
      : `${spec.team}/${mine}/${spec.moving ?? "walk"}/${n}`;
    // Two abreast, the pairs one behind the other, so a team of four is a column and not a row across the road. An odd
    // team leaves one at the front with nobody beside it, and that one runs up the middle rather than off to one side.
    const pair = Math.floor(i / 2), alone = count === 1 || i === count - 1 && count % 2;
    const side = alone ? 0 : i % 2 ? 1 : -1;
    // How long the animal is, nose to tail, in feet: a wolf is not a draught horse, and a frame with no size baked
    // into it was being drawn at a horse's ten feet (Roi, of the sled's pack: "i think the wolves scale is weird,
    // they are also low quality (blurry)" — both are the same fault, a 256px frame stretched to two squares).
    out.push({ group, path, feet: spec.feet ?? TEAM_FEET, rope: spec.rope === true,
      ahead: ahead + pair * (spec.rows ?? 0), across: side * ((spec.apart ?? 0) / 2) });
  }
  return out;
}

/**
 * Which way a carrier points, in radians, for the baked picture: the frames are painted facing up the sheet, so a carrier
 * heading east turns a quarter turn. Standing still it keeps the way it was pointing (`was`, or east by default), because
 * a wagon does not spin on the spot when the GM nudges it.
 */
export function headingOf(dx = 0, dy = 0, was = 0) {
  if (Math.hypot(dx, dy) < 1e-3) return was;
  return Math.atan2(dy, dx) + Math.PI / 2;
}

/** How far apart two places are, in grid squares. */
export const travelOf = (from, to, grid = 100) =>
  Math.hypot((to?.x ?? 0) - (from?.x ?? 0), (to?.y ?? 0) - (from?.y ?? 0)) / (grid || 100);

/**
 * Everything the carrier's look needs for one moment, from the state the caller keeps for that token:
 * `{ set, path, turn, rolled }`, or null when it wears no baked picture at all.
 * `state` is { rolled, turn } and is handed back updated, so the caller keeps one object per token.
 */
export function lookStep({ id = "", kind = "", look = "", from = null, to = null, grid = 100, moving = true, rough = 0.5, load = 0, now = 0 } = {}, state = {}) {
  const set = lookFor(kind, look);
  const step = from && to ? travelOf(from, to, grid) : 0;
  const rolled = (Number(state.rolled) || 0) + step;
  const turn = headingOf((to?.x ?? 0) - (from?.x ?? 0), (to?.y ?? 0) - (from?.y ?? 0), Number(state.turn) || 0);
  const shown = leanTurn(state.shown, turn, step);
  const ride = moving ? bodyRide(rolled, { rough, load }) : { sway: 0, jolt: 0, shove: 0 };
  const phase = rollPhase(rolled, moving);
  state.rolled = rolled; state.turn = turn; state.shown = shown;
  // A carrier with nothing baked for it still rides: a sled jolts and a barge swings whether or not we have a picture
  // of one, and its sounds are driven off that. It comes back with no `set` and no `path`, so nothing is drawn.
  const coat = set ? coatOf(id) : 0, still = idleFrame(now, id), own = SETS[set];
  return { set, coat, group: groupOf(set),
    // A painted carrier needs no frame: it is drawn from its set, how far it has rolled (which carries the tread
    // round) and the size the map wants it at.
    painted: isPainted(set), paint: own?.paint ?? null, decor: own?.decor ?? null, span: own?.span ?? 0,
    path: set && !isPainted(set) ? framePath(set, coat, phase, still) : null,
    team: set ? teamStep(set, coat, rolled, moving, now, id) : null,
    turn, drawn: shown + ride.sway, rolled, phase, ...ride };
}

// ---- How it rides ----
// Roi's mock: "wheels jolt with the ground, the body sways behind them, and the load leans a beat later". From straight
// above that is three things, all small: the body swings a little side to side as it rolls, it kicks when a wheel drops
// into something, and on a turn it does not snap round — it swings wide and comes straight again a moment later.

// How far the body swings, in radians, at its worst: about a degree and a half, which reads as alive and not as a wobble.
const SWAY = 0.026;
// One swing of the body for every so many squares rolled, and one wheel-drop somewhere in every so many.
const SWAY_EVERY = 1.6;
const JOLT_EVERY = 2.4;

// A steady number from -1 to 1 for a place along the road (pure): the same on every screen, so one wagon rides the same
// for everybody watching it.
function roadNoise(at) {
  const n = Math.sin(at * 12.9898) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

/**
 * How the body is riding after `rolled` squares (pure): `sway` the swing to add to its heading, `jolt` how hard a wheel
 * has just dropped (0 to 1), `shove` how far that throws the body sideways in token widths. `rough` is the ground under
 * it, 0 for a paved road and 1 for a rutted track; `load` how laden it is, 0 to 1 — a loaded wagon swings slower and
 * further and lands heavier, as the mock has it.
 */
export function bodyRide(rolled = 0, { rough = 0.5, load = 0 } = {}) {
  const r = Number(rolled) || 0;
  const hard = 0.45 + 0.55 * Math.min(1, Math.max(0, rough));
  const laden = 1 + 0.5 * Math.min(1, Math.max(0, load));
  const sway = Math.sin((r / (SWAY_EVERY * laden)) * Math.PI * 2) * SWAY * hard * laden;
  // The drop itself: each stretch of road has one place that kicks, and the kick dies away over a quarter of a square.
  const span = r / JOLT_EVERY, where = Math.floor(span), into = (span - where) - (roadNoise(where) * 0.5 + 0.5) * 0.9;
  const jolt = into >= 0 && into < 0.1 ? (1 - into / 0.1) * hard * laden : 0;
  return { sway, jolt, shove: jolt * 0.035 * (roadNoise(where + 0.5) >= 0 ? 1 : -1) };
}

/**
 * The heading actually drawn (pure): the body follows the way it is going, but a beat later, so it swings wide coming
 * round and settles straight after. `shown` is where it was pointing, `turn` where it is going now, `step` how far it has
 * rolled since — the further it has rolled, the more it has caught up.
 */
export function leanTurn(shown, turn, step = 0) {
  if (!Number.isFinite(shown)) return turn;
  const off = Math.atan2(Math.sin(turn - shown), Math.cos(turn - shown));
  return shown + off * Math.min(1, 0.12 + (Number(step) || 0) * 1.6);
}

// What each of these really is, in feet, as the game's own vehicles have it (Pathfinder 2e, GM Core: a Wagon and a
// Carriage take 10 feet by 10, a Cart and a Rowboat 10 by 5, a Sled 5 by 5). Roi: "something about the scale still
// doesnt fit" — a wagon fitted to a one-square token has a bed five feet end to end, which puts the horse in front of
// it somewhere between a pony and a large dog beside a man who fills his own square. So the bed is never drawn shorter
// than the vehicle really is; a GM who wants a bigger one makes the token bigger.
// `tall` is how high the thing stands, in feet, which is how far its shadow reaches: an open wagon is about chest
// high, a covered one twice that, a hand cart waist high, a horse about six feet to the top of its head. Without it
// the shadow took a wagon for a creature as tall as its token is wide and threw one half the yard long.
export const TRUE_FEET = Object.freeze({
  wagon: Object.freeze({ long: 10, wide: 10, tall: 5 }),
  tilt: Object.freeze({ long: 10, wide: 10, tall: 9 }),
  cart: Object.freeze({ long: 10, wide: 5, tall: 3 }),
  // A horse is a Large creature: ten feet long and five wide, the same as the game gives it.
  horse: Object.freeze({ long: 10, wide: 5, tall: 6 }),
  // The game's own vehicle list again: a Sled is five feet by five, a Rowboat ten by five.
  sled: Object.freeze({ long: 6, wide: 4, tall: 2 }),
  boat: Object.freeze({ long: 10, wide: 5, tall: 3 }),
});
/** How tall a carrier of this set stands, in squares, for the shadow it throws; 0 where nothing is known. */
export const trueTall = (set = "", feet = 5) => (TRUE_FEET[set] ? TRUE_FEET[set].tall / (Number(feet) || 5) : 0);

/**
 * How big the baked picture is drawn over the token: along the length the token covers, or the length the vehicle
 * really is where that is longer. `feet` is what one square is worth on this map. The picture is square and the
 * vehicle is drawn up it, so its width follows.
 */
export const lookSize = (width = 1, height = 1, grid = 100, { set = "", feet = 5 } = {}) => {
  const token = Math.max(Number(width) || 1, Number(height) || 1) * grid;
  const real = TRUE_FEET[set] ? (TRUE_FEET[set].long / (Number(feet) || 5)) * grid : 0;
  const along = Math.max(token, real);
  return { w: along, h: along };
};
/**
 * What one square is worth in metres, from the scene's own grid ("5 ft", "1.5 m"), so a picture baked in metres can be
 * drawn at the size the thing really is whatever units the map is in.
 */
export const squareMetres = (distance = 5, units = "ft") =>
  (String(units ?? "").trim().toLowerCase().startsWith("m") ? 1 : 0.3048) * (Number(distance) || 5);
/** How wide to draw a picture whose cell holds `metres` of ground, on a grid of `grid` pixels a square. */
export const drawnSize = (metres = 0, grid = 100, square = 1.524) =>
  (Number(metres) > 0 && square > 0 ? (Number(metres) / square) * grid : 0);

/** How many squares a carrier of this kind really takes, for telling a GM its token is smaller than the thing on it. */
export const trueSquares = (set = "", feet = 5) => {
  const real = TRUE_FEET[set];
  return real ? { long: real.long / (Number(feet) || 5), wide: real.wide / (Number(feet) || 5) } : null;
};
