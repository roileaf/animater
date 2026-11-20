// What a building hangs out for a feast day, as shapes: the scalloped rope of a garland with its lanterns, and a
// banner hung off the eave. Pure geometry — no canvas, no PIXI, no clock — so the wind can be asked for any moment
// and the answer tested without drawing anything.
//
// This is geometry rather than a painted picture because these things move. A roof is painted once and baked into
// a texture, which is what makes a thousand slates affordable and is also why nothing painted into it can ever
// stir (Roi: "lets also make it move with the wind"). So the dressing is kept out of that picture and drawn fresh
// each tick from these points by painted-dressing.mjs.

/** What a dressed building can put up. */
export const DRESSING_KINDS = Object.freeze(['garlands', 'banners', 'both']);
export const DRESSING_CHOICES = Object.freeze([
  Object.freeze({ id: 'garlands', label: 'Garlands', about: 'A scalloped rope of lanterns along the eaves.' }),
  Object.freeze({ id: 'banners', label: 'Banners', about: 'Cloth hung from the eaves, flapping in the wind.' }),
  Object.freeze({ id: 'both', label: 'Both', about: 'Garlands along the eaves and banners hanging off them.' }),
]);
export const dressingKindOf = (said) => (DRESSING_KINDS.includes(said) ? said : 'garlands');

/**
 * How much of its length a flag keeps when nothing is blowing. Truly limp is nothing at all seen from overhead,
 * and a flag drawn that way reads as a torn scrap rather than as stillness (Roi, on one: "ummm.. looks bad...").
 * Map art draws flags out for the same reason it draws roofs lit from one corner: a thing you cannot see is not
 * decoration. So the cloth stays mostly out, and the wind answers in the flutter and in which way it points.
 */
export const FLAG_FLOOR = 0.3;


const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

/**
 * The way out of a building across one of its edges: the edge's own normal, turned to point away from the middle.
 * In pixels, not as a share of the way to the middle — a share is a different distance at a corner than half way
 * along a long wall, and a rope hung by one came out lopsided on anything that was not square.
 */
export function outwardOf(a, b, middle) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  const n = [-dy / l, dx / l];
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const away = (mid[0] - middle[0]) * n[0] + (mid[1] - middle[1]) * n[1] >= 0 ? 1 : -1;
  return [n[0] * away, n[1] * away];
}

/**
 * The wind as a thing hanging off this wall feels it: whatever is blowing, with the part blowing *into* the
 * building taken out. A building is in the way — a wind onto a wall cannot carry a rope or a flag back through it
 * and over the roof, it can only slide what hangs there along the face of it. Verified across every wall at every
 * eighth of the compass, after a check turned up the rope creeping inside on a head-on wind while the flags were
 * already behaving (Roi: "i dont think the banner and garland suports all wind directions, can you verify?").
 */
/**
 * How much of the wind a wall actually gets. A building shelters its own lee: the face the wind is driving at
 * takes all of it, the faces along the sides take some, and the one tucked round the back is in the lee and
 * barely stirs (Roi: "the side that's protected by the wind shouldnt move that much by the wind"). Without this
 * every wall of a building swung alike, which is right for none of them.
 */
export function sheltered(wind, windDir, out, lee = LEE_SHELTER) {
  const blow = unit(windDir), face = unit(out);
  // 1 where the wall faces into the wind, -1 where it has its back to it.
  const into = -(blow[0] * face[0] + blow[1] * face[1]);
  const much = Math.max(0, Math.min(1, Number(wind) || 0));
  return much * (lee + (1 - lee) * (0.5 + 0.5 * into));
}

/** What a wall in the full lee still feels: eddies round a building, never quite nothing. */
export const LEE_SHELTER = 0.25;

/**
 * How much of the wind can actually carry a flag on this wall, nought to one. A wind blowing straight at a wall
 * carries nothing: the cloth is pressed back against the building and has nowhere to go, so it hangs short. A
 * wind along the wall, or out from it, carries all of it. In between it is what is left after the part that
 * drives into the wall is taken out.
 *
 * This is why a flag on the wall the wind is hitting was lying full length along it, which is not what a flag
 * pinned against a wall does (Roi: "just shorten it like the wind is coming from the right man").
 */
export function windCarries(windDir, out) {
  const blow = unit(windDir), face = unit(out);
  const into = blow[0] * face[0] + blow[1] * face[1];
  if (into >= 0) return 1;
  return Math.max(0, Math.min(1, Math.hypot(blow[0] - face[0] * into, blow[1] - face[1] * into)));
}

export function blownAlong(windDir, out) {
  const blow = unit(windDir), face = unit(out);
  const into = blow[0] * face[0] + blow[1] * face[1];
  if (into >= 0) return blow;
  const slid = [blow[0] - face[0] * into, blow[1] - face[1] * into];
  // Straight onto the wall there is nothing of it left to slide along, and nothing to push with either.
  return Math.hypot(slid[0], slid[1]) > 0.05 ? unit(slid) : [0, 0];
}

/**
 * How deeply the rope is swinging at `t` along an edge: nought at each fastening, all of it at each dip. This is
 * the shape of the thing — a rope nailed up every so often and sagging between — and it is also what decides how
 * far the wind can take any part of it.
 */
export const scallop = (t, swags) => (1 - Math.cos(Math.max(0, Math.min(1, t)) * Math.max(1, swags) * 2 * Math.PI)) / 2;

/**
 * The rope along one edge, as points. `wind` blows it: the fastenings are nailed down and cannot move, so the
 * push is taken by the dips, in proportion to how far each part is already swinging. `phase` is the breathing of
 * it over time, which does the same.
 */
export function ropePoints(a, b, out, { swags = 3, hang = 2, amp = 9, fine = 12, wind = 0, windDir = [1, 0], phase = 0 } = {}) {
  const many = Math.max(8, Math.round(Math.max(1, swags) * fine));
  const blow = blownAlong(windDir, out), gust = Math.max(0, Math.min(1, wind));
  const points = [];
  for (let i = 0; i <= many; i++) {
    const t = i / many;
    const deep = scallop(t, swags);
    // A gust lifts the swing as well as pushing it sideways; a still day leaves it hanging as it is.
    const swing = hang + amp * deep * (1 + gust * 0.35 * Math.sin(phase + t * Math.PI * 2 * Math.max(1, swags)));
    const push = gust * amp * 1.1 * deep;
    points.push([
      a[0] + (b[0] - a[0]) * t + out[0] * swing + blow[0] * push,
      a[1] + (b[1] - a[1]) * t + out[1] * swing + blow[1] * push,
    ]);
  }
  return points;
}

/** Where the lanterns hang: the bottom of each swing, which is where anything hung on a rope ends up. */
export function lanternSpots(a, b, out, { swags = 3, hang = 2, amp = 9, lamp = 4, wind = 0, windDir = [1, 0], phase = 0 } = {}) {
  const blow = blownAlong(windDir, out), gust = Math.max(0, Math.min(1, wind)), spots = [];
  for (let k = 0; k < Math.max(1, swags); k++) {
    const t = (k + 0.5) / Math.max(1, swags), deep = scallop(t, swags);
    const swing = hang + amp * deep * (1 + gust * 0.35 * Math.sin(phase + t * Math.PI * 2 * Math.max(1, swags))) + lamp * 0.9;
    const push = gust * amp * 1.1 * deep;
    spots.push({
      at: [a[0] + (b[0] - a[0]) * t + out[0] * swing + blow[0] * push, a[1] + (b[1] - a[1]) * t + out[1] * swing + blow[1] * push],
      nail: [a[0] + (b[0] - a[0]) * (k / Math.max(1, swags)) + out[0] * hang, a[1] + (b[1] - a[1]) * (k / Math.max(1, swags)) + out[1] * hang],
      lit: k % 2 === 0,
    });
  }
  return spots;
}

/**
 * A banner hung from a point on the eave, as the outline of its cloth. It falls outward from the building, and
 * the wind takes it: the head is nailed up and barely moves, the tail swings and ripples, more of both the harder
 * it blows. Seen from above that is a tapering strip reaching out from the eave with a wave along it.
 */
export function bannerShape(at, out, { pole = 26, long = 46, wide = 13, ribs = 16, wind = 0, windDir = [1, 0], phase = 0, floor = FLAG_FLOOR } = {}) {
  const blow = unit(windDir), gust = Math.max(0, Math.min(1, wind));
  const jut = unit(out);
  // The pole juts straight out of the wall and does not move; the cloth hangs off its end.
  const tip = [at[0] + jut[0] * pole, at[1] + jut[1] * pole];
  // A flag streams downwind, and does not care which wall it is on. It used to lie along its own wall in still
  // air, which fanned a building's flags out like a compass rose — every wall pointing a different way, and all
  // of them fully out on a day with no wind in it at all.
  //
  // Still, a flag hangs straight down the pole, and straight down is nothing at all from overhead: a stub by the
  // pole and no more. It reaches out as the wind gets up and goes narrow and limp as it drops.
  // Downwind — but never back through the building it is nailed to (Roi: "it's OVER the roof.."). The same rule
  // the rope hangs by.
  const slid = blownAlong(blow, jut);
  // On a wall the wind hits dead on there is nothing left to stream along, and the cloth is pressed against the
  // face and flutters sideways. Which sideways was taken from the way the building's outline happened to be
  // wound, so a flag pointed down on one wall and up on the next for no reason anybody could see (Roi: "why is
  // it pointing down?"). It leans the way the wind is already going along the wall instead, and where even that
  // is nothing it hangs — and a hanging flag is short, which is what `reach` is for.
  const side = [-jut[1], jut[0]];
  const lean = blow[0] * side[0] + blow[1] * side[1];
  const fly = Math.hypot(slid[0], slid[1]) > 0.05 ? slid : (lean >= 0 ? side : [-side[0], -side[1]]);
  const across = [-fly[1], fly[0]];
  const held = Math.max(0, Math.min(1, Number.isFinite(Number(floor)) ? Number(floor) : FLAG_FLOOR));
  // Not the wind, but the part of it that can take the cloth anywhere: head-on against the wall it carries
  // nothing and the flag hangs short, whatever the gale is doing.
  const lift = held + (1 - held) * gust * windCarries(blow, jut);
  const reach = long * lift;
  // The width is the hoist, the edge fixed along the pole, and that edge is horizontal whichever way the wind is
  // blowing — so from overhead it is always seen in full. What foreshortens is the length: a flag that is not
  // held out trails downward, and a thing trailing downward is short from above, not narrow. Narrowing it by the
  // wind's angle was wrong twice over (Roi: "you made it thin instead of shorter, imagine a flag pushed by the
  // wind..."), and `reach` above already says the true thing.
  const cloth = wide;
  const left = [], right = [], bands = [];
  const wave = (t) => Math.sin(phase * 2.1 + t * Math.PI * 2.6) * cloth * 0.5 * t * t * (0.2 + gust * 1.1);
  for (let i = 0; i <= ribs; i++) {
    const t = i / ribs;
    // Nailed to the pole at the hoist and loose at the fly: the flutter is in the tail, not through the middle.
    const flutter = wave(t);
    const half = (cloth / 2) * (1 - t * 0.82); // a pennant: broad at the pole, a point at the end
    const spine = [tip[0] + fly[0] * reach * t + across[0] * flutter, tip[1] + fly[1] * reach * t + across[1] * flutter];
    left.push([spine[0] + across[0] * half, spine[1] + across[1] * half]);
    right.push([spine[0] - across[0] * half, spine[1] - across[1] * half]);
    // Which way this rib of cloth is leaning. Cloth in a wind is not one flat colour: it turns toward the light
    // and away from it along its folds, and that banding is what makes it read as fabric rather than as a shape.
    const step = 1 / ribs;
    bands.push(Math.max(-1, Math.min(1, (wave(Math.min(1, t + step)) - wave(Math.max(0, t - step))) / (cloth * 0.5 + 1e-6))));
  }
  // The ribs, so a drawer can lay the cloth down a band at a time the way a roof lays its courses.
  const run = [];
  for (let i = 0; i < ribs; i++) run.push({ quad: [left[i], left[i + 1], right[i + 1], right[i]], lean: (bands[i] + bands[i + 1]) / 2, at: i / ribs });
  return { pole: [at, tip], cloth: [...left, ...right.reverse()], ribs: run };
}

/**
 * How the dressing sits in the day: what its shadow does, how much the lanterns are worth looking at, and what
 * the weather has put on it. Roi: "it should also cast shadows be affected by the sun\weather etc" — which it can
 * now, because it is drawn afresh each tick instead of being baked into the roof.
 *
 * `sun` is the scene's own: `{ angle, height, strength }`, or null underground and at night.
 */
export function dressingLook({ sun = null, snow = 0, wet = 0 } = {}) {
  const strength = Math.max(0, Math.min(1, Number(sun?.strength) || 0));
  const height = Number.isFinite(Number(sun?.height)) ? Math.max(0, Math.min(90, Number(sun.height))) : 45;
  const angle = ((Number(sun?.angle) || 0) * Math.PI) / 180;
  // A low sun throws a long shadow, a high one a short one; no sun throws none at all.
  const low = 1 - height / 90;
  return {
    shadow: {
      // Away from the sun, as everything else on the map throws it.
      dir: sun ? [-Math.cos(angle), -Math.sin(angle)] : [0, 0],
      long: sun ? (0.35 + low * 1.9) * strength : 0,
      // Faint. A rope's shadow is a smudge, and drawn at the old weight it came out as a solid grey copy of the
      // rope lying beside it.
      dark: sun ? 0.08 + 0.12 * strength : 0,
    },
    // Lanterns are worth lighting when the sun is not doing it for them: at dusk, at night, in a storm.
    glow: Math.max(0, Math.min(1, 1 - strength * (0.35 + 0.65 * (height / 90)))),
    // Snow gathers along the top of a rope and sits on a lantern's cap; rain only darkens the cloth.
    snow: Math.max(0, Math.min(1, Number(snow) || 0)),
    wet: Math.max(0, Math.min(1, Number(wet) || 0)),
  };
}

/** Where banners hang along one edge: a few, spaced, and never so many that a wall is a row of curtains. */
export function bannerSpots(a, b, out, { every = 180, least = 1, most = 4, bite = 6 } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const many = Math.max(least, Math.min(most, Math.round(len / Math.max(1, every))));
  const spots = [];
  for (let k = 0; k < many; k++) {
    const t = (k + 0.5) / many;
    // Set back *into* the eave, not out past it. A pole fixed to a building starts in the building; stood off
    // the edge it floated, with daylight between it and the roof it was supposed to be nailed to (Roi: "the pole
    // also doesnt touch the roof lol").
    spots.push([a[0] + (b[0] - a[0]) * t - out[0] * bite, a[1] + (b[1] - a[1]) * t - out[1] * bite]);
  }
  return spots;
}
