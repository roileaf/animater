// Arriving on a scene. Today a map is simply there, at full size and full volume, on the first frame the GM pulls
// the party to it. This gives it a moment to settle in: a breath of dark, the map easing into place, and the sound,
// the weather and the light coming up behind it rather than landing all at once.
//
// Whose choice it is. A beat that suits a reveal is tiresome on the corridor the party crosses four times in a
// session, so this is never on by itself: each scene says for itself what it does, and says nothing until its GM
// chooses (arrivalHere). The module setting is only the default a scene falls back to when it has not spoken.
//
// Pure: no Foundry, no PIXI. The shell runs the clock and moves the camera; everything about what a frame should
// look like, and what the card should say, is decided here.

export const ARRIVALS = Object.freeze({
  off: "No arrival: the map is simply there",
  settle: "Settle: a breath of dark, then the map eases into place",
  sweep: "Sweep: in close and off to one side, drifting out across the map",
  dawn: "Dawn: barely moves, and the light comes up on it instead",
  tremor: "Tremor: the ground is shaking as they get there, and quietens",
  storm: "Storm: a flash of lightning shows them where they are",
  wide: "Wide: starts back from the map and pushes in on it",
});

// How long each beat lasts. A few seconds: long enough to feel like arriving somewhere, short enough that nobody
// waits for it twice.
export const ARRIVAL_MS = Object.freeze({ settle: 2600, sweep: 3400, dawn: 3800, tremor: 2800, storm: 3000, wide: 3200 });

// What each beat does, in fractions of the frame: how far in it starts (`zoom`, below 1 to start back from the
// map), how far it slides, how long the dark holds (a share of the whole), how soft it starts, whether the light
// comes up with it, how hard the ground shakes to begin with, and whether lightning shows them the place.
const BEATS = Object.freeze({
  settle: { zoom: 1.08, dx: 0, dy: 0.012, veil: 0.16, blur: 5, lifts: false, shake: 0, flash: false },
  sweep: { zoom: 1.22, dx: -0.05, dy: 0.03, veil: 0.09, blur: 8, lifts: false, shake: 0, flash: false },
  dawn: { zoom: 1.04, dx: 0, dy: 0, veil: 0.24, blur: 2, lifts: true, shake: 0, flash: false },
  tremor: { zoom: 1.03, dx: 0, dy: 0, veil: 0.1, blur: 3, lifts: false, shake: 1, flash: false },
  storm: { zoom: 1.06, dx: 0, dy: 0, veil: 0.08, blur: 4, lifts: true, shake: 0.25, flash: true },
  wide: { zoom: 0.9, dx: 0, dy: 0, veil: 0.13, blur: 3, lifts: false, shake: 0, flash: false },
});

// How hard the ground is still shaking, and which way it has thrown the view this moment (squares). It dies away
// rather than stopping: a tremor that ends on a frame is a glitch, one that fades is a tremor. Two waves that do
// not share a period, so it never settles into a rhythm. (engines/camera/camera-shake.mjs does the same for a
// blow landing; this is the same idea arriving somewhere.)
export function arrivalShake(beat, t) {
  const how = BEATS[known(beat) ?? "off"];
  const p = clamp01(t);
  if (!how?.shake) return { x: 0, y: 0, left: 0 };
  // Gone by three quarters through, so the map is perfectly still while the card is still up.
  const left = how.shake * Math.max(0, 1 - p / 0.75) ** 2;
  // (+ 0 so a shudder that has died ends at 0 and never at -0.)
  return { x: left * (0.6 * Math.sin(p * 61) + 0.4 * Math.sin(p * 143)) + 0, y: left * (0.5 * Math.sin(p * 77 + 1.7) + 0.5 * Math.sin(p * 109 + 0.4)) + 0, left };
}

// How bright the lightning is this moment, 0 to 1: a hard first strike as the dark goes, a dip, a weaker second,
// then nothing. Only the storm has one. (The shape lightning already flashes in: flashLevel, above.)
export function arrivalFlash(beat, t) {
  if (!BEATS[known(beat) ?? "off"]?.flash) return 0;
  const p = clamp01(t);
  if (p > 0.45) return 0;
  const first = Math.max(0, 1 - Math.abs(p - 0.06) / 0.07);
  const second = Math.max(0, 1 - Math.abs(p - 0.26) / 0.09) * 0.45;
  return Math.min(1, Math.max(first, second));
}

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const known = (beat) => (Object.hasOwn(ARRIVALS, beat) ? beat : null);

// What this scene does when the party arrives on it: its own choice, else the GM's default for the table, else
// nothing at all. `flag` the scene's own (flags.animater.arrival), `setting` the module's.
export function arrivalHere(flag, setting) {
  return known(flag) ?? known(setting) ?? "off";
}

// The frame `t` of the way through the beat (0 to 1): how far in the camera is (`zoom`, 1 the map's true size),
// how far it is slid (`dx`, `dy`, fractions of the frame), how much dark is still over it (`veil`), how soft it is
// (`blur`, pixels), and how much of the scene's own light has come up (`light`, 1 all of it).
export function arrivalAt(beat, t) {
  const how = BEATS[known(beat) ?? "off"];
  if (!how) return { zoom: 1, dx: 0, dy: 0, veil: 0, blur: 0, light: 1 };
  const p = clamp01(t), e = 1 - Math.pow(1 - p, 3), left = 1 - e;
  return {
    zoom: 1 + (how.zoom - 1) * left,
    // (+ 0 so a slide that ends at nothing ends at 0 and never at -0, which a saved frame would carry about.)
    dx: how.dx * left + 0, dy: how.dy * left + 0,
    // The dark lifts early and the map keeps easing after it, so the scene is arriving rather than being revealed.
    veil: clamp01(1 - p / how.veil),
    blur: how.blur * left,
    light: how.lifts ? 0.22 + 0.78 * e : 1,
  };
}

// How far through its ambience, its weather and its light are, each a little behind the picture. The point of the
// beat as much as the camera is: a scene that arrives at full volume has not arrived, it has been dropped.
export const arrivalRise = (t) => {
  const e = 1 - Math.pow(1 - clamp01(t), 3);
  return { sound: clamp01(e * 1.25), weather: clamp01((e - 0.15) * 1.5), light: clamp01((e - 0.3) * 1.8) };
};

// The hour as a person would say it, from the clock's day (0 to 1) and where it puts sunrise and sunset. No clock,
// no claim: an empty string, and the card simply does without it.
export function hourWord(day, clock = null) {
  if (!Number.isFinite(day)) return "";
  const up = Number.isFinite(clock?.sunrise) ? clock.sunrise : 0.25;
  const down = Number.isFinite(clock?.sunset) ? clock.sunset : 0.78;
  const noon = (up + down) / 2;
  if (day < up - 0.06) return day < 0.12 ? "Deep night" : "Night";
  if (day < up + 0.03) return "Dawn";
  if (day > down + 0.06) return "Night";
  if (day > down - 0.03) return "Dusk";
  if (day < noon - 0.07) return "Morning";
  if (day < noon + 0.05) return "Midday";
  return "Afternoon";
}

// What the card says: the place, and a line under it. The line is what the module already knows — the hour from the
// clock, the weather as it is being drawn — or whatever the GM wrote for this scene instead. Nothing is invented:
// with no clock and no weather there is simply no line.
export function arrivalWords({ name = "", day = null, clock = null, weather = "", own = "" } = {}) {
  const said = String(own ?? "").trim();
  if (said) return { name: String(name ?? ""), under: said };
  const hour = hourWord(Number.isFinite(day) ? day : NaN, clock);
  const sky = String(weather ?? "").trim();
  return { name: String(name ?? ""), under: [hour, sky].filter(Boolean).join(" · ") };
}
