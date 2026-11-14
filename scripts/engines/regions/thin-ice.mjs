// Who thin ice holds and when it gives way. Pure: no Foundry, no PIXI; sizes and squares arrive as plain arguments.

// Creature sizes, smallest to largest, in the order Foundry names them.
export const SIZES = ["tiny", "sm", "med", "lg", "huge", "grg"];

// How far a creature is over what the ice holds: 0 safe (the limit's own size or smaller), 1 one size over, 2 two or more.
// A size we do not know is treated as safe, so odd data never drowns anyone.
export function holdsUp(limit, size) {
  const held = SIZES.indexOf(limit);
  const weight = SIZES.indexOf(size);
  if (held < 0 || weight < 0) return 0;
  return Math.min(2, Math.max(0, weight - held));
}

// What one move does to the ice. Walks the squares entered in order: a creature two sizes over breaks the first and goes
// no further; one size over cracks each square, and breaks one that was already cracked or that the move ended on.
// A square entered twice in one move counts as crossing its own crack. A square is only ever in one list, once. The note is the GM whisper, or null when nothing happened.
export function iceStep({ limit, size, squares = [], cracked = [], ended, name } = {}) {
  const over = holdsUp(limit, size);
  const cracks = [];
  const breaks = [];
  if (over === 2) {
    if (squares.length) breaks.push(squares[0]);
  } else if (over === 1) {
    for (const square of squares) {
      if (breaks.includes(square)) continue;
      // Already cracked, cracked earlier in this same walk, or where the move ended: the ice gives way.
      if (cracked.includes(square) || cracks.includes(square) || square === ended) {
        const i = cracks.indexOf(square);
        if (i >= 0) cracks.splice(i, 1);
        breaks.push(square);
      } else cracks.push(square);
    }
  }
  const who = name || "A creature";
  let note = null;
  if (breaks.length) note = `${who} breaks through the ice into the water (swim).`;
  else if (cracks.length) note = `The ice cracks under ${who}.`;
  return { cracks, breaks, note };
}

const ICE_FLAG = "flags.animater.thinIce";
const SQUARE_KEY = /^-?\d+,-?\d+$/;

// The keys of one stored map that are really squares and really present (a truthy marker), sorted so every client agrees.
function squaresIn(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return Object.keys(map).filter((key) => SQUARE_KEY.test(key) && map[key]).sort();
}

// What a region has stored: `flags.animater.thinIce` holds two maps keyed by square (`{ cracks: { "3,4": 1 }, holes: {} }`),
// because Foundry merges object flags and a key can only be removed by name. Returns the keys as sorted arrays.
// A missing flag, a non-object, junk keys or empty markers read as nothing: a client never breaks on a malformed region.
export function iceStateOf(doc) {
  const stored = doc?.flags?.animater?.thinIce;
  const flag = stored && typeof stored === "object" ? stored : {};
  return { cracks: squaresIn(flag.cracks), holes: squaresIn(flag.holes) };
}

// One judged move (an iceStep result) as updates for scene.updateEmbeddedDocuments("Region", ...): [] when nothing changes.
// A new crack is written at its own key; a break is added to holes, and deleted from cracks by name (`-=` with null, which the
// caller converts) only if it was stored there. A crack on a square already cracked or already a hole changes nothing, and a
// square in both lists breaks. The whole thinIce flag is never written, so no field depends on key order.
export function iceUpdatesFor(step, { region } = {}) {
  const id = region?.id ?? region?._id;
  if (!id) return [];
  const { cracks: stored, holes } = iceStateOf(region);
  const broke = new Set((step?.breaks ?? []).filter((key) => !holes.includes(key)));
  const fields = {};
  for (const key of broke) {
    if (stored.includes(key)) fields[`${ICE_FLAG}.cracks.-=${key}`] = null;
    fields[`${ICE_FLAG}.holes.${key}`] = 1;
  }
  for (const key of step?.cracks ?? []) {
    if (broke.has(key) || stored.includes(key) || holes.includes(key)) continue;
    fields[`${ICE_FLAG}.cracks.${key}`] = 1;
  }
  return Object.keys(fields).length ? [{ _id: id, ...fields }] : [];
}
