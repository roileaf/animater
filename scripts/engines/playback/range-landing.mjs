// When the shot in a range-stretched clip lands. Sequencer plays one of a ranged clip's range variants
// (05/15/30/60/90 ft) picked by the length of the line it stretches over; the object in each variant reaches
// the far end at a time of its own, measured into data/media-landings.mjs (tools/media-timing.mjs). Pure.
import { MEDIA_LANDINGS, RANGE_UNMEASURED } from '../../../data/media-landings.mjs';

// Each variant and the line length, in grid squares, from which Sequencer picks it
// (SequencerFileRangeFind.ftToDistanceMap; the clip's template scale cancels out).
const RANGE_STEPS = [['05ft', 0], ['15ft', 2], ['30ft', 5], ['60ft', 9], ['90ft', 15]];
const VARIANT = /\.(\d\dft)$/;

// The variant Sequencer's rangeFind (getFileForDistance) picks for a line of `distance` px among the
// `available` ones: the longest whose threshold the line reaches; the shortest one also covers shorter lines.
export function rangeVariant(distance, gridPx, available = RANGE_STEPS.map(([ft]) => ft)) {
  const steps = RANGE_STEPS.filter(([ft]) => available.includes(ft));
  if (!steps.length) return null;
  let pick = steps[0][0];
  for (const [ft, squares] of steps) if (distance >= squares * gridPx) pick = ft;
  return pick;
}

// Range clip path -> { ft: landing ms, or null when unmeasured }, built once per pair of tables.
const indexes = new WeakMap();
function indexOf(landings, unmeasured) {
  if (!indexes.get(landings)?.has(unmeasured)) {
    const index = new Map();
    const add = (key, ms) => {
      const at = key.lastIndexOf('.'), base = key.slice(0, at);
      if (!index.has(base)) index.set(base, {});
      index.get(base)[key.slice(at + 1)] = ms;
    };
    for (const [key, ms] of Object.entries(landings)) add(key, ms);
    for (const key of unmeasured) add(key, null);
    if (!indexes.has(landings)) indexes.set(landings, new WeakMap());
    indexes.get(landings).set(unmeasured, index);
  }
  return indexes.get(landings).get(unmeasured);
}
const under = (base, key) => base === key || base.startsWith(`${key}.`);

// What a Sequencer database path plays on a line of `distance` px: { range: false } for a clip without range
// variants (Sequencer stretches the one file, whatever the distance), else { range: true, landing } with the
// media ms from the clip's start at which its shot lands in the picked variant, null when that variant was not
// measured. A path naming its variant (a trailing file index dropped) plays that one. A partial path (Sequencer
// picks one of its entries at random) takes the latest of its entries, and is unmeasured when any entry is.
export function rangeLanding(asset, distance, gridPx, { landings = MEDIA_LANDINGS, unmeasured = RANGE_UNMEASURED } = {}) {
  const key = String(asset ?? '').replace(/\.(\d\dft)\.\d+$/, '.$1');
  if (!key) return { range: false };
  if (VARIANT.test(key)) return { range: true, landing: Number.isFinite(landings[key]) ? landings[key] : null };
  const picks = [...indexOf(landings, unmeasured)].filter(([base]) => under(base, key))
    .map(([, variants]) => variants[rangeVariant(distance, gridPx, Object.keys(variants))]);
  if (!picks.length) return { range: false };
  return { range: true, landing: picks.every(Number.isFinite) ? Math.max(...picks) : null };
}
