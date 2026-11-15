// The word that floats up off thin ice as it goes: CRACK! where a square cracks, THROUGH! where a creature drops into the
// water. The crack is the one thing this feature does that makes no sound and moves nothing, so without a word on the map
// only the GM — who gets the whisper — knows it happened at all. Everyone at the table sees these.
//
// Pure: no Foundry, no PIXI, no canvas. It says what to write, where, how big and in what colour; the caller hands that to
// the screen's own floating text. Junk gives nothing rather than an error, as the rest of the ice does.

export const ICE_WORDS = Object.freeze({ crack: "CRACK!", broke: "THROUGH!" });
// Cold white-blue for a crack, a darker water blue for going through. Outlined, because both land on pale ice.
const LOOK = Object.freeze({
  crack: Object.freeze({ fill: "#dceeff", stroke: "#1d3f66", size: 0.26, rise: 1.0, ms: 1700 }),
  broke: Object.freeze({ fill: "#bfe4ff", stroke: "#0b2440", size: 0.34, rise: 1.3, ms: 2200 }),
});
const KEY = /^(-?\d+),(-?\d+)$/;

// What to float over the square `key` for `kind` ("crack" or "broke"), on a grid of `grid` pixels:
// { text, at: {x, y}, fill, stroke, fontSize, distance, duration }, or null for junk.
// Sized and raised in grid squares, so it reads the same on a map of 70-pixel squares as on one of 200.
export function iceWord(key, kind, { grid } = {}) {
  const m = typeof key === "string" ? KEY.exec(key) : null;
  const look = LOOK[kind];
  const size = Number(grid);
  if (!m || !look || !Number.isFinite(size) || size <= 0) return null;
  return {
    text: ICE_WORDS[kind],
    at: { x: (Number(m[1]) + 0.5) * size, y: (Number(m[2]) + 0.5) * size },
    fill: look.fill,
    stroke: look.stroke,
    fontSize: Math.max(12, Math.round(size * look.size)),
    distance: Math.round(size * look.rise),
    duration: look.ms,
  };
}

// The words for one screen's worth of news: every square that newly cracked, and every one that newly gave way. A square
// that cracked and gave way in the same move says THROUGH! only — the crack is what happened on the way to it, and two
// words stacked on one square read as a mistake.
export function iceWords(news, { grid, cap = 8 } = {}) {
  const { cracked, broke } = news && typeof news === "object" ? news : {};
  const through = new Set(Array.isArray(broke) ? broke : []);
  const out = [];
  for (const key of through) { const w = iceWord(key, "broke", { grid }); if (w) out.push(w); }
  for (const key of Array.isArray(cracked) ? cracked : []) {
    if (through.has(key)) continue;
    const w = iceWord(key, "crack", { grid });
    if (w) out.push(w);
  }
  // A Gargantuan creature crossing a lake could crack a dozen squares at once: show the first few rather than paper the map.
  return out.slice(0, Math.max(1, Number(cap) || 8));
}
