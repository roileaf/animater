// When the shot in a range-stretched clip lands. Sequencer plays one of a ranged clip's range variants
// (05/15/30/60/90 ft) picked by the length of the line it stretches over; the object in each variant reaches
// the far end at a time of its own, measured into data/media-landings.mjs (tools/media-timing.mjs), and a
// luminous one leaves the caster at a time of its own, measured into data/media-departures.mjs. Pure.
import { MEDIA_LANDINGS, RANGE_UNMEASURED } from '../../../data/media-landings.mjs';
import { MEDIA_DEPARTURES } from '../../../data/media-departures.mjs';

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
// variants (Sequencer stretches the one file, whatever the distance), else { range: true, landing, departure }
// with the media ms from the clip's start at which its shot lands in the picked variant, null when that variant
// was not measured, and at which it leaves the caster, null when not measured. A path naming its variant (a
// trailing file index dropped) plays that one. A partial path (Sequencer picks one of its entries at random)
// takes the latest of its entries, and is unmeasured when any entry is.
export function rangeLanding(asset, distance, gridPx, { landings = MEDIA_LANDINGS, unmeasured = RANGE_UNMEASURED, departures = MEDIA_DEPARTURES } = {}) {
  const key = String(asset ?? '').replace(/\.(\d\dft)\.\d+$/, '.$1');
  if (!key) return { range: false };
  const departure = variant => (Number.isFinite(departures[variant]) ? departures[variant] : null);
  if (VARIANT.test(key)) {
    const landing = Number.isFinite(landings[key]) ? landings[key] : null;
    return { range: true, landing, departure: landing === null ? null : departure(key) };
  }
  const picks = [...indexOf(landings, unmeasured)].filter(([base]) => under(base, key)).map(([base, variants]) => {
    const ft = rangeVariant(distance, gridPx, Object.keys(variants));
    return { landing: variants[ft], departure: departure(`${base}.${ft}`) };
  });
  if (!picks.length) return { range: false };
  if (!picks.every(p => Number.isFinite(p.landing))) return { range: true, landing: null, departure: null };
  const latest = picks.reduce((a, b) => (b.landing > a.landing ? b : a));
  return { range: true, landing: latest.landing, departure: latest.departure };
}
