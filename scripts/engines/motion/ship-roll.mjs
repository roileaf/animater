// Ships rock with the sea (a tile ticked "Animater: rocks with the sea"): it rolls about its long axis with the swell,
// gently, so a top-down map only shows it in a slight turn, the sun sliding across its deck and, in a storm, spray over
// the low side. Only drawn: the tile, its walls and the tokens keep their places on the grid. Pure: no Foundry globals.

// How hard the sea throws a ship about (0.8 on a still day, 1.4 in full wind, up to 2.2 in a storm), from the wind (0–1)
// and a storm's strength (0–1). A ship is only ticked to rock because its sea is meant to move it, and most scenes
// carry no wind at all, so the still-day sea is a living one, not a flat one: wind and storm build on it.
export function seaStrength({ wind = 0, storm = 0 } = {}) {
  const w = Math.max(0, Math.min(1, Number(wind) || 0)), s = Math.max(0, Math.min(1, Number(storm) || 0));
  return Math.min(2.2, 0.8 + 0.6 * w + 0.8 * s);
}

// A steady number from a tile's id, so two ships on a map never roll in step.
export function rollSeed(id = "") {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export const ROLL_PERIOD = 5.5;
// A heel never past this, however the swell and the chop fall together.
const MOST = 1.15;

// The roll at `t` seconds: `heel` (-1 to 1, more in a storm; positive puts the deck's far side, local +y, low), the
// turn the picture shows (`tilt`, radians: about half a degree calm, one in full wind, two in a storm), its drift on the swell
// (`drift`, in grid squares) and how far a hanging thing swings against it (`swing`, -1 to 1).
export function shipRoll(t, strength = 1, seed = 0) {
  const k = Math.max(0, Number(strength) || 0), w = (2 * Math.PI) / ROLL_PERIOD, p = seed * 2 * Math.PI;
  const swell = 0.6 + 0.4 * Math.sin(w * 0.41 * t + p * 1.7);
  // The chop on top of the swell: quicker and smaller, so the roll reads as a sea working at the hull and never as a
  // slow slide. (Roi watched a ship in full wind and saw nothing at all: from straight above, a roll under a degree
  // moves a ship's ends a few pixels over several seconds, which no one notices.)
  const chop = 0.24 * Math.sin(w * 2.3 * t + p * 2.9) * Math.min(1, k);
  const reach = k > 0 ? Math.min(1, 0.55 + 0.45 * k) : 0;
  const raw = (Math.sin(w * t + p) * swell + chop) * reach * (k > 1.5 ? 1.12 : 1);
  const heel = Math.max(-MOST, Math.min(MOST, raw)) || 0;
  return {
    heel,
    tilt: heel * (0.016 + 0.008 * k) || 0,
    drift: { x: Math.sin(t * 0.5 + p) * 0.05 * k, y: Math.cos(t * 0.7 + p * 1.3) * 0.04 * k },
    swing: Math.max(-1, Math.min(1, -heel * Math.min(1.4, k))),
  };
}

// The middle of a tile's picture. Foundry v14 hangs a tile on an anchor point: `x` and `y` are where that anchor sits,
// and `anchorX`/`anchorY` say where on the picture it is (0.5, 0.5, its middle, for a tile placed in v14). Older tiles
// hang by their top-left corner, which is an anchor of 0, 0 and the same sum.
export function tileMiddle(tile) {
  const ax = Number(tile?.anchorX) || 0, ay = Number(tile?.anchorY) || 0;
  return { x: tile.x + (0.5 - ax) * tile.width, y: tile.y + (0.5 - ay) * tile.height };
}
// Whether a point lies on a tile's picture rectangle (its rotation about its middle, in degrees).
export function onDeck(point, tile) {
  const { x: cx, y: cy } = tileMiddle(tile), a = (-(Number(tile.rotation) || 0) * Math.PI) / 180;
  const dx = point.x - cx, dy = point.y - cy, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= tile.width / 2 && Math.abs(ly) <= tile.height / 2;
}

// Where a thing standing at `point` is drawn while the deck under it turns by `roll.tilt` about `centre` and drifts by
// `roll.drift` (squares of `grid` px): its offset from where it stands, and its own turn (with a lean for a creature).
export function carriedBy(point, centre, roll, grid = 100, lean = 0) {
  const c = Math.cos(roll.tilt), s = Math.sin(roll.tilt), dx = point.x - centre.x, dy = point.y - centre.y;
  return {
    x: dx * c - dy * s - dx + roll.drift.x * grid,
    y: dx * s + dy * c - dy + roll.drift.y * grid,
    r: roll.tilt + lean * roll.heel * 0.01,
  };
}

// The deck's shade in painted steps across its width: the low side darker in three bands, the high side catching a
// little light. Each band { from, to } runs across the short axis in 0–1 (0 the near edge, local -y), with its `alpha`
// and `dark` (true for shade, false for light).
export function deckShade(heel) {
  const h = Math.max(-1.2, Math.min(1.2, Number(heel) || 0)), m = Math.abs(h);
  if (m < 0.02) return [];
  const low = h > 0 ? 1 : 0, bands = [];
  for (let i = 0; i < 3; i++) {
    const depth = (0.12 + i * 0.1) * m;
    bands.push({ from: low ? 1 - depth : 0, to: low ? 1 : depth, alpha: 0.15 * m, dark: true });
  }
  const lit = 0.1 * m;
  bands.push({ from: low ? 0 : 1 - lit, to: low ? lit : 1, alpha: 0.13 * m, dark: false });
  return bands;
}

// The water round the hull, drawn from the ship's own outline under it: its `shadow` on the water ({ x, y } in grid
// squares off the hull, local axes, and `alpha`), sliding toward the low side as it heels, and the `foam` (the outline
// pushed `y` squares toward the low side, with its `alpha`; `ring` the thin wash all round it, 0–1 of its width).
export function hullWash(heel, strength = 1) {
  const h = Math.max(-1.2, Math.min(1.2, Number(heel) || 0)), k = Math.max(0, Math.min(2.2, Number(strength) || 0));
  return {
    shadow: { x: 0.08, y: 0.12 + 0.07 * h, alpha: 0.32 },
    foam: { y: h * (0.05 + 0.03 * k), alpha: 0.2 + 0.3 * Math.abs(h), ring: 0.015 + 0.01 * Math.min(1, k) },
  };
}
