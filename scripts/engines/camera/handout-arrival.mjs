// A handout arriving. Today Show Players opens a grey window over the map, at full size on its first frame, lit by
// nothing: a thing the interface did, not a thing anybody in the world handed anyone. This gives it a moment and a
// place to arrive from — a letter unfolding along its creases, a scroll running open, a page laid on the table in
// front of the party — and lights it with the scene it arrives into, so a map read by one torch at midnight does not
// look like the same map read at noon.
//
// It is not a window. Roi, of the first version: "it just shows the window opening differently... hardly immersive".
// That was fair — dressing Foundry's frame leaves a title bar, a close button and the sidebar behind it, and no
// amount of unfolding makes a dialog into a sheet of paper. A handout now takes the screen: the room goes dark, the
// page arrives at the size of a thing held in front of you, and a click puts it down again.
//
// Whose choice it is. The look is the table's (the module setting), and any one scene, journal or page may say
// otherwise for itself (handoutHere). Nothing here decides to show anything: the GM still shows a handout the way
// they always have. This only says how it gets there and what light it is under.
//
// Pure: no Foundry, no DOM. The shell runs the clock and owns the element; every number a frame needs is decided
// here and handed over as fractions of the page, so the shell never does arithmetic of its own.

export const HANDOUT_ARRIVALS = Object.freeze({
  off: "No arrival: Foundry's own window, as it is today",
  unfold: "Unfolds: a folded letter opening along its creases",
  unroll: "Unrolls: a scroll, the rolled edge running down it",
  spread: "Spread open: a map scroll pulled apart, a rod running out to each side",
  laid: "Laid down: put on the table in front of them, knocking up dust",
  held: "Held up: raised from below and held there, swaying until it settles",
  blown: "Blown in: a loose page caught by the wind, tumbling until it lands",
  pinned: "Pinned up: swung in from the side and pinned, swaying until it stops",
  lamp: "Lamplight over it: already lying there in the dark, a lamp carried across it",
  any: "Whichever suits it: a different one each time",
});

// How long each takes. Under a second and a half for the ones that are a movement: a handout is read, not watched,
// and a GM who shows four in a row must not be made to wait through four of these.
// A map takes the longest of the movements: it is two hands pulling against each other, not one edge falling open.
// Lamplight is the exception and is meant to be slow — it is a light being carried, and hurrying it is a flicker.
export const HANDOUT_MS = Object.freeze({
  unfold: 900, unroll: 1100, spread: 1250, laid: 820, held: 1000, blown: 1400, pinned: 900, lamp: 1800,
});

// The ones `any` may choose between: everything that actually arrives.
export const HANDOUT_LOOKS = Object.freeze(["unfold", "unroll", "spread", "laid", "held", "blown", "pinned", "lamp"]);

// A map is wider than it is tall, and is given the room for it; everything else arrives as a page.
export const handoutIsWide = (look) => handoutPick(look) === "spread";

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const known = (look) => (Object.hasOwn(HANDOUT_ARRIVALS, look) ? look : null);
// Cubic ease out: fast away from where it came from, slow into place.
const ease = (p) => 1 - Math.pow(1 - p, 3);
// A wobble that dies: `n` swings over the whole, fading to nothing by the end.
const damp = (p, n, fall = 3) => Math.sin(p * Math.PI * n) * Math.pow(1 - p, fall);

// Same text, same number: so one handout always arrives the same way, however many screens it opens on.
export function handoutSeed(text) {
  let h = 2166136261;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

// Which look this handout arrives with. `any` picks one from its own name, so the same handout is the same every
// time and two different ones in a row are not.
export function handoutPick(look, seed = 0) {
  const want = known(look) ?? "off";
  if (want !== "any") return want;
  const n = Number.isFinite(seed) ? Math.abs(seed) % 1 : 0;
  return HANDOUT_LOOKS[Math.min(HANDOUT_LOOKS.length - 1, Math.floor(n * HANDOUT_LOOKS.length))];
}

// Which look wins, narrowest first: the page's own choice, then the scene it arrives into, then the table's setting,
// and nothing if none of them says anything. Anything unrecognised is not a choice and is passed over.
export function handoutHere(...choices) {
  for (const choice of choices) {
    const look = known(choice);
    if (look) return look;
  }
  return "off";
}

// Whether a page's editor should ask how the page arrives at all. A table that has arrivals off, on a map and in a
// journal that choose none, is not using them, and a row at the bottom of every page it edits is clutter for a thing
// it never turned on. A page that already carries a choice of its own always shows it, whatever it says and whether
// or not this build still knows the look, so it can be seen and cleared. `above` is the journal, the scene, the table.
export function handoutOffered(own, ...above) {
  if (String(own ?? "") !== "") return true;
  return above.some((choice) => { const look = known(choice); return look !== null && look !== "off"; });
}

// How long this look takes, 0 when it does not arrive at all.
export const handoutMs = (look) => HANDOUT_MS[handoutPick(look)] ?? 0;

/**
 * The frame `t` of the way through (0 to 1). Everything is a fraction of the page itself, so the shell can place a
 * handout of any size without knowing anything about this:
 *   opacity  0 to 1
 *   scale    1 its true size
 *   dx, dy   how far it is from home, in page widths and heights (positive dy is below where it lands)
 *   rot      degrees, positive clockwise
 *   fold     1 folded shut along its middle crease, 0 flat open  (the shell leans it on its X axis)
 *   crease   how much of the top and bottom is still folded away, each a fraction of the height
 *   roll     how much of the page the rolled edge has not uncovered yet, a fraction of the height
 *   spread   how much of each side a map's two rods have not uncovered yet, a fraction of the width (0.5 shut)
 */
export function handoutAt(look, t) {
  const rest = { opacity: 1, scale: 1, dx: 0, dy: 0, rot: 0, fold: 0, crease: 0, roll: 0, spread: 0, bright: 1 };
  const how = handoutPick(look);
  if (how === "off") return rest;
  const p = clamp01(t), e = ease(p), left = 1 - e;

  if (how === "unfold") {
    return { ...rest,
      opacity: clamp01(p / 0.14),
      // Leans up out of the table as the creases open, so it is a sheet of paper and not a growing rectangle.
      fold: left, crease: 0.36 * left };
  }
  if (how === "unroll") {
    // The rolled edge runs down it; the page is simply not there yet below the edge.
    return { ...rest, opacity: clamp01(p / 0.08), roll: left };
  }
  if (how === "spread") {
    // Two hands pulling against each other: the roll holds for a moment, breaks open at the middle, then runs out
    // to both edges and the paper pulls taut. Nothing of it moves across the table — a map is opened where it lies.
    const open = ease(Math.pow(p, 1.3));
    return { ...rest,
      opacity: clamp01(p / 0.06),
      spread: 0.5 * (1 - open),
      scale: 1 - 0.016 * (1 - open),
      rot: 0.8 * damp(p, 1.5, 3) + 0 };
  }
  if (how === "laid") {
    // Comes up from below and drops the last of the way, knocking against the table once.
    const settle = damp(p, 1.5, 4);
    return { ...rest,
      opacity: clamp01(p / 0.1),
      dy: 0.84 * left - 0.045 * settle + 0,
      rot: -9 * left + 2.6 * settle + 0,
      scale: 1 + 0.1 * left };
  }
  if (how === "held") {
    // Raised from below and held there, swinging a little in whoever's hands until it settles.
    return { ...rest,
      opacity: clamp01(p / 0.1),
      dy: 1.06 * Math.pow(left, 1.4) + 0,
      rot: -2.4 * damp(p, 2.5, 2.2) + 0 };
  }
  if (how === "pinned") {
    // Swung in from the left on whoever's hand, caught at the top corners, and left swinging on its pins until the
    // swing dies. It hangs from near its top edge, so the shell leans it about that corner and not its middle.
    return { ...rest,
      opacity: clamp01(p / 0.1),
      dx: -1.15 * Math.pow(left, 1.25) + 0,
      dy: 0.1 * left,
      rot: -15 * Math.pow(left, 1.3) + 4.4 * damp(p, 3, 2.6) + 0 };
  }
  if (how === "lamp") {
    // Nothing of it moves: it is already lying there. A lamp is carried across it and the page comes out of the dark
    // as the light passes. The sweep itself is handoutLampAt; this is only how lit the paper is by then.
    return { ...rest, opacity: clamp01(p / 0.05), bright: 0.18 + 0.78 * ease(p) };
  }
  // blown: in from above, tumbling, flat by the time it lands.
  return { ...rest,
    opacity: clamp01(p / 0.08),
    dy: -1.4 * left + 0,
    dx: 0.12 * damp(p, 2, 1.6) + 0,
    rot: -24 * left + 11 * damp(p, 2.5, 1.4) + 0,
    scale: 1 - 0.14 * left };
}

/**
 * The sound a handout makes as it arrives, from whatever this build actually ships for that look. `names` is the
 * bundled index's own list for the handouts folder, so a file taken out of assets simply stops being chosen rather
 * than being asked for and failing to load. Null when the look has no sound of its own yet, which is not a fault:
 * the arrival is still seen.
 * The same handout picks the same take every time, the way its look does, so one page does not sound different on
 * two screens.
 */
export function handoutSound(look, names = [], seed = 0) {
  const how = handoutPick(look, seed);
  if (how === "off") return null;
  const mine = (names ?? []).filter((n) => typeof n === "string" && n.startsWith(`${how}-`)).sort();
  if (!mine.length) return null;
  const n = Number.isFinite(seed) ? Math.abs(seed) % 1 : 0;
  return mine[Math.min(mine.length - 1, Math.floor(n * mine.length))];
}

/**
 * When in the arrival its sound starts, as a fraction of the arrival. Most begin with it: the paper is already
 * moving on the first frame, and that is the sound. Two do not — a page pinned up is silent until the pins go in
 * (handoutPins), and a page laid down until it touches the table (handoutDust) — and a tap heard half a second
 * before the pin reaches the wall is the kind of thing that reads as broken without anyone being able to say why.
 */
export function handoutSoundAt(look) {
  const how = handoutPick(look);
  if (how === "pinned") return 0.46;
  if (how === "laid") return 0.4;
  return 0;
}

// Whether this look wants the extras the shell can draw: the rolled rod of a scroll, the two rods of a map spread
// open, the dust a laid page knocks up.
export const handoutHasRod = (look) => handoutPick(look) === "unroll";
export const handoutHasRods = (look) => handoutPick(look) === "spread";
export const handoutHasDust = (look) => handoutPick(look) === "laid";
export const handoutHasPins = (look) => handoutPick(look) === "pinned";
export const handoutHasCreases = (look) => handoutPick(look) === "unfold";
export const handoutHasLamp = (look) => handoutPick(look) === "lamp";

// The pins of a page pinned up: 0 before they are tapped in, 1 once they are. They go in as the swing starts, not
// when the page first appears, or the paper would be hanging from nothing on the way across.
export function handoutPins(look, t) {
  if (!handoutHasPins(look)) return 0;
  return clamp01((clamp01(t) - 0.46) / 0.12);
}

// The lamp carried across a page lying in the dark: where its pool of light is, in page widths from the left edge
// (negative is off the page on that side), and how strong it is. Nothing for any other look.
export function handoutLampAt(look, t) {
  if (!handoutHasLamp(look)) return { x: 0, strength: 0 };
  // Carried, not thrown: it leaves and arrives gently but crosses the middle at an even pace. A cubic ease out here
  // put the light off the far edge by halfway, which read as a flash rather than someone walking a lamp across.
  const p = clamp01(t), e = p * p * (3 - 2 * p);
  return { x: -0.55 + 1.9 * e, strength: clamp01(p / 0.14) * clamp01(1 - Math.max(0, p - 0.9) / 0.1) * 0.9 + 0.1 };
}

// The dust a laid page knocks up: how strong it is this frame, 0 before it lands and after it has drifted off.
export function handoutDust(look, t) {
  if (!handoutHasDust(look)) return 0;
  const p = clamp01(t);
  if (p < 0.4) return 0;
  // Up fast as it touches, then away.
  return clamp01((p - 0.4) / 0.12) * clamp01(1 - (p - 0.52) / 0.48);
}

/**
 * The light the page arrives under, from what the module already knows about the scene. Nothing is invented: with
 * no darkness and no weather this is plain daylight, which is what a handout looks like today.
 *   darkness     the scene's own, 0 full day to 1 full night
 *   weather      the scene's weather by its bare name ("rain", "snow", "thunderstorm"...), or nothing
 *   underground  whether this scene is below ground
 *   lit          whether a light of the party's own reaches them (a torch, a lantern): warm and unsteady
 * Gives back, each 0 to 1 unless said:
 *   warm    how much warm firelight falls across it
 *   cool    how much cold daylight or stormlight instead
 *   veil    how much dark sits over the map behind it
 *   paper   how brightly the page itself is lit (never 0: an unreadable handout is a bug, not atmosphere)
 *   flicker whether the light on it is unsteady
 *   wet     whether rain runs over the view
 */
export function handoutLight({ darkness = 0, weather = "", underground = false, lit = false } = {}) {
  const dark = clamp01(darkness);
  const sky = String(weather ?? "").toLowerCase();
  const raining = /rain|storm|drizzle|shower|sleet|monsoon|hurricane/.test(sky);
  const snowing = /snow|blizzard|ice/.test(sky);
  const dull = raining || snowing || /cloud|overcast|fog|mist/.test(sky);
  // Below ground there is no sky at all: whatever they carry is the only light there is.
  if (underground) {
    return { warm: 1, cool: 0, veil: 0.44, paper: 0.74, flicker: true, wet: false };
  }
  const warm = lit ? Math.max(dark, 0.35) : dark * 0.8;
  const cool = clamp01((1 - dark) * (dull ? 1 : 0.45) + (raining ? 0.3 : 0));
  return {
    warm: clamp01(warm),
    cool: clamp01(dark > 0.72 ? cool * 0.3 : cool),
    veil: clamp01(dark * 0.5 + (dull ? 0.08 : 0)),
    // A page held near a torch is still a lit page; a page at noon is simply bright.
    paper: clamp01(1 - dark * 0.42 + (lit ? 0.18 : 0) - (dull ? 0.08 : 0)),
    flicker: lit && dark > 0.3,
    wet: raining,
  };
}
