// Tokenshade on top-down and pop-out art (a creature on a clear background, seen from above). A look made for an
// upright portrait assumes a ground under the token, a head at the top and feet at the bottom; from above the
// creature can face any way and Animater already casts its real shadow. So on cut-out art:
// - nothing is painted on the ground under it (a sigil disc becomes the aura round the body alone);
// - nothing runs top to bottom (a dark band over the eyes, grey rising from the feet, spread in from the edges instead);
// - glyphs (stars, question marks, drops) go round the middle of the body on a circle seen from above, not round a
//   head at the top of the square;
// - no drop shadow is added below it;
// The art's own motion (a Tokener video) carries the rest: still when held rigid, slower when slowed or worn out.

// Looks whose ground disc, gradient or shadow is the point (markers, rings, a levitating creature's shadow).
const KEEP = /^(?:Marker: |Channel: |Rune Circle$|Tropical Gradient$|Grounded Shadow$|Levitate$)/;
function topDownParams(preset) {
  const out = [];
  for (const p of preset.params ?? []) {
    if (p?.filterType === 'base') continue;
    if (p?.filterType === 'shadow' && p.rotation === 90) continue;
    if (p?.filterType === 'colorGradient' && p.type === 0) { out.push({ ...p, type: 1 }); continue; }
    if (p?.filterType === 'orbit') { out.push({ ...p, flat: true }); continue; }
    out.push(p);
  }
  // A look made only of what is dropped stays as it was.
  return out.length ? out : preset.params;
}

const made = new WeakMap();
// The version of `preset` to show on this art: itself on a portrait or ring token, its top-down form on cut-out art.
export function forArt(preset, cutOut) {
  if (!cutOut || !preset || KEEP.test(preset.name ?? '')) return preset;
  if (!made.has(preset)) {
    const params = topDownParams(preset);
    made.set(preset, params === preset.params ? preset : { ...preset, params });
  }
  return made.get(preset);
}

// How fast a creature's animated art plays under a look: 0 holds it still on its current frame.
const PACE = [
  [/^(?:Paralyzed|Petrified|Turn to (?:stone|iron|gold)|Frozen Solid|Freeze solid|Crystalli[sz]ed?|Crystallize|Sleeping|Lifeless|Dying(?: \d)?)$/, 0],
  [/^Sluggish$/, 0.5],
  [/^Prone$/, 0.6],
  [/^Weary(?: \d)?$/, 0.75],
  [/^Burdened$/, 0.8],
  [/^Weakened(?: \d)?$/, 0.85],
  [/^Trembling(?: \d)?$/, 1.25],
  [/^Quickened$/, 1.5],
];
export function paceOf(name) {
  for (const [re, pace] of PACE) if (re.test(String(name ?? ''))) return pace;
  return null;
}
// Several looks at once: the slowest wins, and held still beats everything. null: the art plays as it would.
export function artPace(names) {
  const paces = [...names].map(paceOf).filter((p) => p !== null);
  return paces.length ? Math.min(...paces) : null;
}
