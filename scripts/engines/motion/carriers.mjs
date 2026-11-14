// Carriers: one token the GM moves, and the tokens stowed aboard it. Roi asked for a wagon the party gets into with one
// press and out of with another, so a carrier is an ordinary token — only a token moves with the ruler, respects walls
// and carries light and vision — and the wagon is its art.
//
// A passenger keeps its seat on the carrier and rides along: its torch still lights the road, it still sees out, its
// own player still sees it, and its conditions and its place in the combat tracker are untouched. Nothing is ever
// deleted. Unloading puts everyone down around wherever the carrier has stopped, in the formation they got on with
// where that still fits beside it, nudged off anything in the way.
//
// Riding used to mean `hidden`, which turned out to cost the three things the wagon was for: Foundry 14 gives a hidden
// token no light source at all (Token#_isLightSource opens `if (hidden) return false`), no vision unless the PF2e
// Party Vision setting is on (off by default), and no sight of itself for its own player (isVisible has no owner
// exemption). A party that boarded at night put out its own torches and went blind. So a passenger rides in plain
// sight now, and a GM who wants it out of sight asks for that (`STOW`) and is told what it costs.
//
// Pure: no Foundry, no canvas. The caller says what a token's place is and what ground is free.

export const ABOARD = "aboard";
export const KIND = "carrier";
// Set on the carrier by a GM who wants its passengers out of sight while they ride. Off by default, and never set by
// the module itself, because of what hiding costs them.
export const STOW = "carrierStow";
// Set on the passenger, naming the carrier it rides: the carrier's own list is the truth, but a token that remembers
// what it was riding can be found and put down again when that list is lost (the carrier deleted out from under it,
// its flag wiped, the scene imported, the module turned off and on).
export const RIDING = "ridingOn";

// What a carrier is. The kind changes nothing about carrying — stowing a party is the same in a boat as in a cart — but it
// says which token will take a token dropped on it, and it is what the wheels, the oars and their sounds will read later.
export const CARRIER_KINDS = Object.freeze({
  "": "Not a carrier",
  // What a token becomes the moment the GM presses Load on it without having set anything: it carries, and that is all —
  // no wheels, no wake, no vehicle drawn over it. A party token, a palanquin, a giant's hand.
  party: "Carries (nothing added)",
  wagon: "Wagon",
  cart: "Cart (hand cart)",
  boat: "Boat",
  sled: "Sled",
  mount: "Mount",
});
export const carrierKind = (kind) => (kind in CARRIER_KINDS && kind ? kind : "");
export const kindLabel = (kind) => CARRIER_KINDS[carrierKind(kind)] ?? CARRIER_KINDS[""];

// How many a thing of this kind plainly holds. The game's own vehicles each carry a Crew and a Passengers line, and the
// numbers below are what the drawn vehicle has room for — a hand cart takes a child and a sack, not a marching company.
// It is never a wall: a GM who wants nine in a rowboat gets them, and is told once that it is nine in a rowboat.
export const CAPACITY = Object.freeze({ wagon: 6, cart: 2, sled: 2, boat: 4, mount: 1, party: Infinity });
/** How many this kind holds; a token merely told to carry holds whatever the GM puts in it. */
export const capacityOf = (kind) => CAPACITY[carrierKind(kind)] ?? Infinity;
/** How many more than it holds `n` aboard would be; 0 when it fits. */
export const overCapacity = (kind, n = 0) => Math.max(0, n - capacityOf(kind));
/**
 * Whether a passenger is plainly too big for the carrier: wider or longer than the ground the carrier itself covers.
 * A horse does not get into a hand cart, and an ogre does not get onto a sled.
 */
export const tooBig = (carrier, token) =>
  (Number(token?.width) || 1) > (Number(carrier?.width) || 1) || (Number(token?.height) || 1) > (Number(carrier?.height) || 1);

// The ground a carrier stands on: its own square and the ones its width and height cover.
const footprint = (c, grid) => ({ x: c.x, y: c.y, w: (Number(c.width) || 1) * grid, h: (Number(c.height) || 1) * grid });
// Which carrier a point has been put down on, biggest last so a cart on a barge wins over the barge.
export function carrierAt(point, carriers = [], grid = 100) {
  let best = null, small = Infinity;
  for (const c of carriers) {
    if (!carrierKind(c?.kind)) continue;
    const f = footprint(c, grid), size = f.w * f.h;
    if (point.x < f.x || point.y < f.y || point.x > f.x + f.w || point.y > f.y + f.h) continue;
    if (size < small) { best = c; small = size; }
  }
  return best;
}
// Whether a passenger has been pulled clear of the carrier it is riding: dropped off its footprint, it is getting out.
export function pulledOff(point, carrier, grid = 100) {
  const f = footprint(carrier, grid);
  return point.x < f.x || point.y < f.y || point.x > f.x + f.w || point.y > f.y + f.h;
}

// Where a thing is, as this engine wants it: { id, x, y, elevation }.
const at = (t) => ({ x: Number(t?.x) || 0, y: Number(t?.y) || 0, elevation: Number(t?.elevation) || 0 });

// Who may get on: anything that is not the carrier itself, is not already aboard it, and is not itself a carrier. A
// wagon on a barge used to be allowed as long as the wagon was empty, and then the wagon's own passengers were left
// standing on the bank: the barge moves the wagon as a carrier's own doing, and a carrier's own doing is exactly what
// the hook that would have moved them steps aside for. Two carriers can also each be told to carry the other. So a
// carrier is not cargo, and the GM is told why.
export function boarding(carrier, tokens = [], aboard = []) {
  const on = new Set(aboard.map((p) => p.id));
  return tokens.filter((t) => t && t.id !== carrier?.id && !on.has(t.id) && !(t.carries?.length > 0) && !carrierKind(t.kind));
}

// Where each passenger rides, as an offset from the carrier's corner: on the carrier itself, a square at a time across
// the ground it covers, and round again where there are more aboard than squares. Roi: "when boarding all tokens
// should gather ON the carrier square and move with it" — they used to ride at the offset they happened to be standing
// at, strung out behind the wagon and beside it. On a grid whose cells are not squares (hex, or none at all) there is
// no row of seats to lay out, so everyone rides at the carrier's own place.
export function aboardSpots(carrier, n = 0, grid = 100, { square = true } = {}) {
  const wide = Math.max(1, Math.round(Number(carrier?.width) || 1)), high = Math.max(1, Math.round(Number(carrier?.height) || 1));
  const spots = [];
  for (let i = 0; i < Math.max(0, n); i++) {
    if (!square) { spots.push({ dx: 0, dy: 0 }); continue; }
    const seat = i % (wide * high);
    spots.push({ dx: (seat % wide) * grid, dy: Math.floor(seat / wide) * grid });
  }
  return spots;
}

// The list to keep on the carrier: each passenger's id, where it rides (`ax`, `ay`: its seat on the carrier) and where
// it stood when it got on (`dx`, `dy`), which is the formation it is put back down in where that still fits.
export function boardList(carrier, tokens = [], aboard = [], grid = 100, { square = true } = {}) {
  const c = at(carrier), coming = boarding(carrier, tokens, aboard);
  const spots = aboardSpots(carrier, aboard.length + coming.length, grid, { square });
  return [
    ...aboard.map((p, i) => ({ ...p, ...(spots[i] ? { ax: spots[i].dx, ay: spots[i].dy } : {}) })),
    ...coming.map((t, i) => {
      const p = at(t), spot = spots[aboard.length + i] ?? { dx: 0, dy: 0 };
      return { id: t.id, dx: p.x - c.x, dy: p.y - c.y, ax: spot.dx, ay: spot.dy, dz: p.elevation - c.elevation, hidden: t.hidden === true };
    }),
  ];
}

// Passengers whose tokens are still on the scene. One deleted by hand simply stops being aboard.
export const stillAboard = (aboard = [], exists = () => true) => aboard.filter((p) => exists(p.id));

/**
 * Where each passenger rides as the carrier moves: in its seat on the carrier (an older list with no seats keeps the
 * offset it got on at), at the carrier's height, and drawn over it rather than under it — a rider you cannot see on
 * the horse is not mounted.
 *
 * Whether it can be seen is left alone unless somebody is asking for a change: `stow` hides them, `show` brings back
 * the ones the GM had not hidden himself. A plain move down the road says nothing about it at all. That is not only
 * tidiness — a wagon that restated `hidden` on every move was writing it into the middle of Foundry's own movement
 * traffic, and every so often the value that came back from the server was the one from before the move, so the
 * party blinked out somewhere down the road for no reason anyone could see.
 */
export function ridePlan(aboard = [], carrier, { stow = false, show = false, sort = null } = {}) {
  const c = at(carrier);
  return aboard.map((p) => {
    const seen = stow === true ? { hidden: true } : show === true ? { hidden: p.hidden === true } : {};
    return {
      _id: p.id,
      x: c.x + (Number.isFinite(p.ax) ? p.ax : p.dx), y: c.y + (Number.isFinite(p.ay) ? p.ay : p.dy),
      elevation: c.elevation + p.dz, ...seen,
      ...(Number.isFinite(sort) ? { sort: sort + 1 } : {}),
    };
  });
}

// The spots to try for a passenger stepping out, in order: the squares round the carrier, nearest first, then further
// rings out. Roi: "when disembarking the carried tokens should exit next to the carrier not in their original place"
// — a party that boarded from across the field used to be flung back across it when the wagon stopped somewhere else
// entirely, which is not getting out of a wagon. `toward` (radians) is the side to try first, for a GM who wants them
// out on the side away from the arrows. On a grid that is not made of squares the ring is a real ring.
export function aroundSpots(carrier, grid = 100, rings = 4, { square = true, toward = null } = {}) {
  const wide = Math.max(1, Math.round(Number(carrier?.width) || 1)), high = Math.max(1, Math.round(Number(carrier?.height) || 1));
  const mid = { x: ((wide - 1) / 2) * grid, y: ((high - 1) / 2) * grid }, out = [];
  const lean = Number.isFinite(toward)
    ? (a) => Math.abs(Math.atan2(Math.sin(Math.atan2(a.dy - mid.y, a.dx - mid.x) - toward), Math.cos(Math.atan2(a.dy - mid.y, a.dx - mid.x) - toward)))
    : null;
  const near = (a) => Math.hypot(a.dx - mid.x, a.dy - mid.y);
  for (let r = 1; r <= rings; r++) {
    const ring = [];
    if (square) {
      for (let gx = -r; gx < wide + r; gx++) for (let gy = -r; gy < high + r; gy++) {
        if (gx > -r && gx < wide + r - 1 && gy > -r && gy < high + r - 1) continue;
        ring.push({ dx: gx * grid, dy: gy * grid });
      }
    } else {
      // No squares to step into: a ring of places round the carrier, more of them the further out it goes.
      const many = 6 * r, reach = (Math.max(wide, high) / 2 + r - 0.5) * grid;
      for (let i = 0; i < many; i++) {
        const a = (i / many) * Math.PI * 2;
        ring.push({ dx: mid.x + Math.cos(a) * reach, dy: mid.y + Math.sin(a) * reach });
      }
    }
    // Round the carrier rather than along one side of it: the nearest place to its middle first, or the one most
    // nearly on the side the caller asked for.
    ring.sort((a, b) => (lean ? lean(a) - lean(b) || near(a) - near(b) : near(a) - near(b)));
    out.push(...ring);
  }
  return out;
}

// Whether the place a passenger got on at is still beside the carrier: within one square of the ground it covers. One
// that stepped up from the roadside gets put down on the roadside again, in the formation it had; one that boarded
// from across the field does not get thrown back across it.
const beside = (p, carrier, grid) => {
  const wide = Math.max(1, Math.round(Number(carrier?.width) || 1)), high = Math.max(1, Math.round(Number(carrier?.height) || 1));
  if (!Number.isFinite(p?.dx) || !Number.isFinite(p?.dy)) return false;
  // Not on the carrier's own ground: one that climbed in from the deck square itself has no roadside to go back to.
  const off = p.dx < 0 || p.dx >= wide * grid || p.dy < 0 || p.dy >= high * grid;
  return off && p.dx >= -grid && p.dx <= wide * grid && p.dy >= -grid && p.dy <= high * grid;
};

/**
 * Where each passenger steps out: the place it got on at where that is still beside the carrier, else the nearest free
 * square round it, nudged off anything in the way, and never two in the same place. `free(x, y, id)` is the caller's:
 * the ground, the walls, the other tokens. `toward` (radians) is the side to try first.
 * A passenger the GM had hidden before it got on stays hidden when it gets off.
 */
export function landPlan(aboard = [], carrier, { grid = 100, free = () => true, square = true, toward = null } = {}) {
  const c = at(carrier), taken = [], round = aroundSpots(carrier, grid, 4, { square, toward });
  const clear = (x, y, id) => free(x, y, id) && !taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < grid * 0.5);
  return aboard.map((p) => {
    const own = beside(p, carrier, grid) ? [c.x + p.dx, c.y + p.dy] : null;
    const spot = (own && clear(own[0], own[1], p.id) ? own : null)
      ?? round.map(({ dx, dy }) => [c.x + dx, c.y + dy]).find(([x, y]) => clear(x, y, p.id))
      // Nowhere free at all: down beside the carrier anyway rather than left aboard a wagon nobody can see them in.
      ?? [c.x + round[0].dx, c.y + round[0].dy];
    taken.push(spot);
    return { _id: p.id, x: spot[0], y: spot[1], elevation: c.elevation + p.dz, hidden: p.hidden === true };
  });
}

// What the HUD button says: with tokens picked out, how many would get on; with passengers aboard, how many get off.
// Roi: "when i have no token selected i want to press the button to carry all party members". So with nothing picked
// out the button still works and takes the party — `who` says which of the two it would be, for the wording.
export function boardLabel(aboard = [], picked = 0, party = 0) {
  if (aboard.length) return { action: "unload", label: `Unload ${aboard.length}`, count: aboard.length };
  if (picked > 0) return { action: "load", who: "picked", label: `Load ${picked}`, count: picked };
  if (party > 0) return { action: "load", who: "party", label: `Load the party (${party})`, count: party };
  return { action: "none", label: "Pick who gets on first", count: 0 };
}
