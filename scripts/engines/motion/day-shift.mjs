// The change of shift at the ends of the day: the birds all singing at first light, then going quiet as the sun sets,
// a hush, and the crickets taking over once it is properly dark. Pure: main.mjs asks here how much of each there is now.

const clamp01 = (v) => Math.min(1, Math.max(0, v));
// How far `f` lies after `from` on the day's circle, as -0.5 to 0.5 of a day.
const offset = (f, from) => ((((f - from) % 1) + 1.5) % 1) - 0.5;
const ramp = (v, a, b) => clamp01((v - a) / (b - a));

// A day is 1. The chorus starts half an hour before sunrise, is fullest for the half hour after it, gone an hour and a half in.
const CHORUS = { start: -0.021, full: 0, hold: 0.021, end: 0.063 };
// The birds stop a little before the sun is down; the crickets start about forty minutes after it.
const QUIET = { start: -0.021, end: 0.004 }, CRICKETS = { start: 0.021, end: 0.042 }, CRICKETS_END = { start: -0.05, end: -0.021 };

/**
 * What the day is doing now (pure). `clock`: { day, sunrise, sunset }, fractions of the day (main.mjs clockNow).
 * chorus 0-1: how full the dawn chorus is. birds 0-1: how much the day's birds still sing. crickets 0-1: how much of the
 * night's bed may be heard. hush 0-1: the silence between the last bird and the first cricket.
 */
export function dayShift(clock) {
  const day = Number(clock?.day);
  if (!Number.isFinite(day)) return { chorus: 0, birds: 1, crickets: 1, hush: 0 };
  const sunrise = Number(clock.sunrise ?? 0.25), sunset = Number(clock.sunset ?? 0.75), f = ((day % 1) + 1) % 1;
  const fromRise = offset(f, sunrise), fromSet = offset(f, sunset);
  const chorus = fromRise <= CHORUS.hold ? ramp(fromRise, CHORUS.start, CHORUS.full) : 1 - ramp(fromRise, CHORUS.hold, CHORUS.end);
  const dayNow = f > sunrise && f < sunset;
  const birds = dayNow ? 1 - ramp(fromSet, QUIET.start, QUIET.end) : chorus;
  // Crickets rise after sunset and fall away before sunrise; by day there are none.
  const crickets = f >= sunset || f <= sunrise ? (f >= sunset ? ramp(fromSet, CRICKETS.start, CRICKETS.end) : 1) * (1 - ramp(fromRise, CRICKETS_END.start, CRICKETS_END.end)) : 0;
  const hush = fromSet > -0.03 && fromSet < CRICKETS.end ? clamp01(1 - birds - crickets) : 0;
  return { chorus, birds, crickets, hush };
}

// Seconds to the next bird of the chorus (pure): one every couple of seconds at its first, several a second at its fullest.
export const chorusGap = (chorus, random = Math.random) => (chorus > 0.02 ? (0.18 + (1 - clamp01(chorus)) * 2) * (0.5 + random()) : Infinity);

// Where a bird of the chorus sings, round whoever listens (pure): in a ring, near enough to hear, never on top of them.
export function chorusSpot(ear, grid, random = Math.random) {
  const way = random() * Math.PI * 2, far = grid * (3 + random() * 7);
  return { x: ear.x + Math.cos(way) * far, y: ear.y + Math.sin(way) * far };
}
