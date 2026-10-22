// When the shot in a range-stretched clip lands. Sequencer plays one of a ranged clip's range variants
// (05/15/30/60/90 ft) picked by the length of the line it stretches over; the object in each variant reaches
// the far end at a time of its own, measured into data/media-landings.mjs (tools/media-timing.mjs). Pure.
import { MEDIA_LANDINGS } from '../../../data/media-landings.mjs';

// Each variant and the line length, in grid squares, from which Sequencer picks it
// (SequencerFileRangeFind.ftToDistanceMap; the clip's template scale cancels out).
const RANGE_STEPS = [['05ft', 0], ['15ft', 2], ['30ft', 5], ['60ft', 9], ['90ft', 15]];

// The variant Sequencer's rangeFind (getFileForDistance) picks for a line of `distance` px among the
// `available` ones: the longest whose threshold the line reaches; the shortest one also covers shorter lines.
export function rangeVariant(distance, gridPx, available = RANGE_STEPS.map(([ft]) => ft)) {
  const steps = RANGE_STEPS.filter(([ft]) => available.includes(ft));
  if (!steps.length) return null;
  let pick = steps[0][0];
  for (const [ft, squares] of steps) if (distance >= squares * gridPx) pick = ft;
  return pick;
}

// Database path -> { ft: landing ms }, built once per table.
const indexes = new WeakMap();
function indexOf(table) {
  if (!indexes.has(table)) {
    const index = new Map();
    for (const [key, ms] of Object.entries(table)) {
      const at = key.lastIndexOf('.'), base = key.slice(0, at);
      if (!index.has(base)) index.set(base, {});
      index.get(base)[key.slice(at + 1)] = ms;
    }
    indexes.set(table, index);
  }
  return indexes.get(table);
}

// When the shot of `asset` (a Sequencer database path) lands, in media ms from the clip's start, on a line of
// `distance` px; null when it was never measured. A path naming its variant plays that one. A partial path
// (Sequencer picks one of its entries at random) takes the latest of its entries, so nothing lands later.
export function rangeLanding(asset, distance, gridPx, table = MEDIA_LANDINGS) {
  const key = String(asset ?? '');
  if (!key) return null;
  if (Number.isFinite(table[key])) return table[key];
  const times = [];
  for (const [base, variants] of indexOf(table))
    if (base === key || base.startsWith(`${key}.`)) {
      const ft = rangeVariant(distance, gridPx, Object.keys(variants));
      if (ft) times.push(variants[ft]);
    }
  return times.length ? Math.max(...times) : null;
}
