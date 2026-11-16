// Moments: the effects Animater already draws, called by hand.
//
// Everything else in this module reads the game and acts on it — a hit lands, a condition takes hold, the weather
// turns. That is the point of it, and it leaves one gap: the GM who needs the floor to shudder because the thing in
// the dark just moved, and no roll will ever tell us so. A moment is that. It is called on one screen and shown on
// the screens the GM chooses, it changes nothing in the world, and it stops.
//
// What makes one of these worth having over a bare screen filter is where it happens. A moment can be the whole
// screen, as such things usually are; or a place on the map, in which case it is strongest for whoever is looking
// at that place and barely there for someone across the map; or the tokens the GM picked, which follow them about.
//
// Pure: no Foundry, no PIXI. What a moment is, who may see it, how strong it is for a given view, and what the
// screen looks like with several running all live here. The shell only paints what this describes.

// `on`: the board itself (moved and graded as one, so it cannot be put in one corner of the map) or a layer over it
// (which can). `holds`: it stays until stopped. `ms`: how long the ones that end take. `strength`: where its slider
// starts. `colour`: for the ones that have one.
export const MOMENTS = Object.freeze({
  shake: { name: "Shake", hint: "One jolt, and it dies away", on: "board", holds: false, ms: 900, strength: 0.6, wheres: ["screen", "point"] },
  rumble: { name: "Rumble", hint: "A floor that will not keep still", on: "board", holds: true, strength: 0.35, wheres: ["screen", "point"] },
  roll: { name: "Lean", hint: "The whole view tilts and sways", on: "board", holds: true, strength: 0.4, wheres: ["screen"] },
  blur: { name: "Swim", hint: "Nothing will quite come into focus", on: "board", holds: true, strength: 0.4, wheres: ["screen", "point"] },
  grey: { name: "Grey", hint: "The colour drains out of the world", on: "board", holds: true, strength: 0.8, wheres: ["screen", "point"] },
  split: { name: "Split", hint: "The colours come apart at the edges", on: "board", holds: true, strength: 0.5, wheres: ["screen", "point"] },
  smear: { name: "Smear", hint: "Everything drags a ghost behind it", on: "board", holds: true, strength: 0.5, wheres: ["screen"] },
  pulse: { name: "Pulse", hint: "A wash of colour over everything", on: "layer", holds: false, ms: 700, strength: 0.5, colour: "#c81e1e", wheres: ["screen", "point", "tokens"] },
  vignette: { name: "Close in", hint: "The edges close in, dark or in a colour of your own", on: "layer", holds: true, strength: 0.7, colour: "#06070a", wheres: ["screen", "point", "tokens"] },
  grain: { name: "Grain", hint: "The air is full of something", on: "layer", holds: true, strength: 0.5, wheres: ["screen", "point"] },
  streak: { name: "Streak", hint: "Lines of speed tearing past", on: "layer", holds: true, strength: 0.45, wheres: ["screen", "point"] },
  // Ours, and the reason a place matters: these are worth nothing spread over a whole screen.
  glow: { name: "Glow", hint: "A light swelling where you put it", on: "layer", holds: true, strength: 0.6, colour: "#ffb347", wheres: ["point", "tokens"] },
  // Not a ring drawn over the map: the map's own shockwave, the one a blast sends out, which bends the ground and
  // everything standing on it (engines/motion/energy-blast.mjs blastRipple, through the distortion host).
  shock: { name: "Shock", hint: "The map's own shockwave, bending the ground and what stands on it", on: "warp", holds: false, ms: 1800, strength: 0.7, wheres: ["point", "tokens"] },
  dust: { name: "Dust", hint: "Dust shaken down from above", on: "layer", holds: false, ms: 2200, strength: 0.5, wheres: ["point", "tokens"] },
  // On the things themselves rather than on the view: these want something chosen, and say so if they get nothing.
  sway: { name: "Sway", hint: "What you picked rocks where it stands", on: "thing", holds: true, strength: 0.5, needs: "things", wheres: ["tokens"] },
  bob: { name: "Bob", hint: "What you picked rides up and down, as on water", on: "thing", holds: true, strength: 0.5, needs: "things", wheres: ["tokens"] },
  tether: { name: "Tether", hint: "A line drawn between what you picked", on: "link", holds: true, strength: 0.7, colour: "#9fd4ff", needs: "two", wheres: ["tokens"] },
});

// How a thing sways. A sign in a breeze wanders; a wagon jolts on its axle, quick and hard, never far; a boat
// rolls long and deep on the swell. (The carriers already ride this way under their own engines; this is the same
// idea put in a GM's hand for anything at all.)
export const SWAYS = Object.freeze({
  breeze: { name: "In a breeze", lean: 9, lift: 0.012, slow: 1.1, quick: 2.7, jolt: 0 },
  wagon: { name: "On a cart", lean: 4, lift: 0.05, slow: 2.3, quick: 6.1, jolt: 0.6 },
  boat: { name: "On the swell", lean: 13, lift: 0.07, slow: 0.52, quick: 1.3, jolt: 0 },
});

// How a tether is drawn. A rope hangs, a chain hangs heavier and darker, a beam is straight and bright.
export const TETHERS = Object.freeze({
  rope: { name: "Rope", sag: 0.22, width: 3, glow: 0, dash: null },
  chain: { name: "Chain", sag: 0.3, width: 5, glow: 0, dash: "9 5" },
  beam: { name: "Beam", sag: 0, width: 4, glow: 1, dash: null },
  thread: { name: "Thread", sag: 0.08, width: 1.5, glow: 0.4, dash: "2 6" },
});

// Where a moment happens. A place and the chosen tokens are both ours; FX Bus has only the first of these.
export const WHERES = Object.freeze({
  screen: "The whole screen",
  point: "At a place on the map",
  tokens: "On the chosen tokens",
});

// The most of anything one screen will take, however many are running. A GM mid-scene should not be able to make
// the map unusable, by accident or otherwise.
export const MOMENT_MOST = 1;
// How long a moment that holds takes to come up when no fade was asked for, and the longest any may be asked to run
// (ten minutes: long enough for a scene, short enough that one forgotten does not outlast the session).
export const MOMENT_RISE_MS = 600;
export const MOMENT_LONGEST_MS = 10 * 60 * 1000;
// How far past its own radius a place still reaches, as a share of the view.
export const REACH_SOFT = 1.1;

export const BOARD_REST = Object.freeze({ shakeX: 0, shakeY: 0, roll: 0, blur: 0, grey: 0, split: 0, smear: 0 });

const clamp = (v, most = MOMENT_MOST) => Math.min(most, Math.max(0, Number.isFinite(v) ? v : 0));
const known = (kind) => (typeof kind === "string" && Object.hasOwn(MOMENTS, kind) ? MOMENTS[kind] : null);
// A colour is three or six hex digits and nothing else: this crosses a socket and ends up in a style.
const COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const idList = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && id))];

// The styles a moment has, if any: a tether is drawn one of several ways, a sway and a bob move one of several
// ways, and everything else has none. The panel asks this rather than knowing which is which.
export const momentStyles = (kind) => (kind === "tether" ? TETHERS : kind === "sway" || kind === "bob" ? SWAYS : {});
export const momentStyleKeys = (kind) => Object.keys(momentStyles(kind));

/**
 * What a GM asked for, as it will travel and as it will be read back:
 * { kind, strength, colour, where, x, y, radius, ids, ms, fade, at }.
 * `at` is when it began, on the clock both ends share. Anything that is not a moment gives null; anything that is
 * not a strength, a colour, a place or a length falls back to what that moment usually is.
 */
export function momentCall(kind, { strength = null, colour = null, where = "screen", x = null, y = null, radius = null, ids = null, ms = null, fade = null, style = null, beat = false, heard = undefined, sound = null, at = 0 } = {}) {
  const how = known(kind);
  if (!how) return null;
  const asked = Number(strength), told = Number(ms), soften = Number(fade);
  // (A number, not merely something Number() will turn into one: null and "" both become 0, and a place at 0,0 is
  // a real place on a map. A point with nowhere to be is the whole screen instead.)
  const said = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const spot = where === "point" && said(x) && said(y);
  const picked = where === "tokens" ? idList(ids) : [];
  const place = spot ? "point" : picked.length ? "tokens" : "screen";
  return {
    kind,
    strength: strength === null || strength === undefined || !Number.isFinite(asked) ? how.strength : clamp(asked),
    colour: COLOUR.test(String(colour)) ? String(colour) : (how.colour ?? null),
    where: place,
    x: spot ? Number(x) : null,
    y: spot ? Number(y) : null,
    radius: spot ? Math.max(1, Number(radius) > 0 ? Number(radius) : 300) : null,
    ids: picked,
    // Asked for a length, it runs that long whether or not it would have held; asked for nothing, it does what it
    // does. Never longer than MOMENT_LONGEST_MS, so one left behind cannot outlast the scene.
    ms: Number.isFinite(told) && told > 0 ? Math.min(MOMENT_LONGEST_MS, told) : (how.holds ? null : how.ms),
    fade: Number.isFinite(soften) && soften > 0 ? Math.min(MOMENT_LONGEST_MS, soften) : null,
    // How it is drawn or how it moves, from that kind's own list and no other's.
    style: momentStyles(kind)[style] ? style : (momentStyleKeys(kind)[0] ?? null),
    // Breathing rather than sitting flat: any moment that holds can be asked to come and go, which is the thing a
    // GM reaches for when the room is meant to feel alive rather than filtered.
    beat: beat === true,
    // What it is heard as: the module's own, nothing, or a file the GM chose. Saying nothing takes the one that
    // suits that moment; saying "" takes silence, which is how a GM turns a sound off.
    heard: heard === undefined ? momentHeardBy(kind) : (Object.hasOwn(MOMENT_SOUNDS, heard) ? heard : null),
    sound: soundPath(sound),
    at: Number.isFinite(Number(at)) ? Number(at) : 0,
  };
}

// Whether a moment has run out. One that holds never has: it waits to be stopped.
export const momentOver = (call, now) => !!call && call.ms !== null && Number(now) - call.at >= call.ms;
// The ones still worth keeping: the shell drops the rest rather than growing a list for a whole session.
export const momentsLeft = (calls, now) => (calls ?? []).filter((c) => c && known(c.kind) && !momentOver(c, now));
// The same, without one kind: a GM pressing a moment that is already running means to stop it, not to have two.
export const momentsWithout = (calls, kind) => (calls ?? []).filter((c) => c && c.kind !== kind);
// Whether that kind is running now, which is what lights its tile and what makes the next press a stop.
export const momentRunning = (calls, kind, now) => (calls ?? []).some((c) => c?.kind === kind && !momentOver(c, now));

// Who sees it: the users named, or null for everyone. (The socket already drops a message whose audience does not
// include this screen, so this only has to say it cleanly.)
export function momentAudience(ids) {
  const list = idList(ids);
  return list.length ? list : null;
}

/**
 * How much of a moment reaches this view (0–1). The whole screen is all of it wherever you are looking. A place is
 * all of it when you are over the place and fades away as you look elsewhere, which is what lets a GM shake the
 * floor of one room without touching the party on the other side of the map.
 * `view`: { x, y, scale, width, height } — the camera's centre in map pixels and the size of the window.
 */
export function momentReach(call, view = null) {
  if (!call || call.where !== "point") return 1;
  if (!view || !Number.isFinite(view.x) || !Number.isFinite(view.y)) return 1;
  const scale = Number(view.scale) > 0 ? Number(view.scale) : 1;
  // How far the place is from the middle of the view, against what the view covers plus the moment's own radius.
  const seen = Math.max(1, Math.hypot(Number(view.width) || 1600, Number(view.height) || 900) / 2 / scale);
  const away = Math.hypot(call.x - view.x, call.y - view.y);
  const far = (call.radius ?? 300) + seen * REACH_SOFT;
  return clamp(1 - (away / far) ** 2);
}

// How far in or out of its fade a moment is now (0–1): up at the start, down at the end, and 1 in between.
function fadeAt(call, now) {
  const since = now - call.at;
  const soft = call.fade ?? (call.ms === null ? MOMENT_RISE_MS : 0);
  if (!soft) return call.ms === null ? 1 : Math.max(0, 1 - since / call.ms);
  // A fade longer than the moment itself still begins and ends at nothing.
  const room = call.ms === null ? soft : Math.min(soft, call.ms / 2);
  const up = room > 0 ? Math.min(1, since / room) : 1;
  const down = call.ms === null ? 1 : room > 0 ? Math.min(1, (call.ms - since) / room) : 1;
  return clamp(Math.min(up, down));
}

// A moment asked to breathe: it comes and goes between a third of itself and all of it, slowly, so a room feels
// alive rather than filtered. Never to nothing, or it would read as a fault rather than a pulse.
export const BEAT_MS = 2600, BEAT_LOW = 0.34;
export function beatAt(call, now) {
  if (!call?.beat) return 1;
  const turn = ((Number(now) || 0) - call.at) / BEAT_MS * Math.PI * 2;
  return BEAT_LOW + (1 - BEAT_LOW) * (0.5 + 0.5 * Math.sin(turn - Math.PI / 2));
}

// Two waves that do not share a period, so a shudder never settles into a rhythm.
const shiver = (t, seed) => ({ x: 0.6 * Math.sin(t * 61 + seed) + 0.4 * Math.sin(t * 143 + seed * 2.1), y: 0.5 * Math.sin(t * 77 + seed * 1.7) + 0.5 * Math.sin(t * 109 + seed * 0.4) });

/**
 * One screen, with every moment on it.
 * `board`: what is done to the map itself — shake (squares), roll (degrees), blur, grey, split, smear (0–1). It is
 *   one picture, so these are the strongest of each rather than the sum.
 * `layers`: what is drawn over it, one to a moment: { kind, strength, colour, x, y, radius, ids, t }, where `x` and
 *   `y` are map pixels and null means the whole screen, and `t` is how far through that moment is (0–1).
 */
export function screenFrom(calls, now = 0, view = null) {
  const when = Number(now) || 0;
  const board = { ...BOARD_REST };
  const layers = [], things = [];
  let shake = 0, seed = 0;
  for (const call of calls ?? []) {
    const how = known(call?.kind);
    if (!how || !Number.isFinite(call.at) || when < call.at || momentOver(call, when)) continue;
    const strength = clamp(call.strength) * fadeAt(call, when) * momentReach(call, view) * beatAt(call, when);
    if (strength <= 0.0005) continue;
    const since = (when - call.at) / 1000;
    seed += 1.7;
    if (how.on === "layer") {
      layers.push({ kind: call.kind, strength, colour: call.colour, x: call.x, y: call.y, radius: call.radius, ids: call.ids, t: call.ms === null ? 1 : clamp((when - call.at) / call.ms) });
      continue;
    }
    // Moments that take hold of the things themselves rather than the view: the shell moves them and draws
    // between them, and this only says which, how hard, and in what style.
    if (how.on === "thing" || how.on === "link") {
      things.push({ kind: call.kind, strength, colour: call.colour, ids: call.ids, style: call.style, call });
      continue;
    }
    switch (call.kind) {
      case "shake": case "rumble": {
        const s = call.kind === "shake" ? strength : strength * 0.5;
        shake = Math.max(shake, s);
        const w = shiver(since, seed);
        board.shakeX += w.x * s; board.shakeY += w.y * s;
        break;
      }
      case "roll": board.roll = Math.max(board.roll, strength * 6); break;
      case "blur": board.blur = Math.max(board.blur, strength); break;
      case "grey": board.grey = Math.max(board.grey, strength); break;
      case "split": board.split = Math.max(board.split, strength); break;
      case "smear": board.smear = Math.max(board.smear, strength); break;
      default: break;
    }
  }
  // However many are shaking at once, the view goes no further than the strongest of them would have taken it.
  const thrown = Math.hypot(board.shakeX, board.shakeY);
  if (thrown > shake && thrown > 0) { board.shakeX *= shake / thrown; board.shakeY *= shake / thrown; }
  return { board, layers, things };
}

// How a thing is standing this moment under a sway or a bob: a lean in degrees and a lift in its own heights.
// Each thing gets its own seed, so a row of hanging signs does not move as one board.
export function thingSway(call, now, seed = 0) {
  const how = known(call?.kind);
  if (!how || how.on !== "thing") return { lean: 0, lift: 0 };
  const strength = clamp(call.strength) * fadeAt(call, Number(now) || 0) * beatAt(call, Number(now) || 0);
  if (strength <= 0) return { lean: 0, lift: 0 };
  const t = ((Number(now) || 0) - call.at) / 1000, s = (Number(seed) || 0) * 2.399;
  const way = SWAYS[call.style] ?? SWAYS.breeze;
  // Not one wave: a thing on a rope answers the air, which is never regular.
  const slow = Math.sin(t * way.slow + s), quick = Math.sin(t * way.quick + s * 1.7);
  // A cart on a rough road does not sway, it is thrown: a short, hard kick between the waves.
  const jolt = way.jolt ? way.jolt * Math.pow(Math.max(0, Math.sin(t * way.quick * 1.37 + s * 2.3)), 8) : 0;
  if (call.kind === "bob") return { lean: strength * way.lean * 0.18 * quick, lift: strength * (way.lift + 0.05) * (0.7 * slow + 0.3 * quick + jolt) };
  return { lean: strength * way.lean * (0.75 * slow + 0.25 * quick + jolt), lift: strength * way.lift * (quick + jolt) };
}

// The line a tether hangs in, as points from one end to the other: a rope and a chain sag, a beam is straight.
// `kind` from TETHERS. Given fewer than two ends there is nothing to draw.
export function tetherPath(from, to, { kind = "rope", strength = 1, at = 0, now = 0, points = 14 } = {}) {
  if (!from || !to || !Number.isFinite(from.x) || !Number.isFinite(to.x)) return [];
  const how = Object.hasOwn(TETHERS, kind) ? TETHERS[kind] : TETHERS.rope;
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const sag = how.sag * span * clamp(strength);
  // A hanging line swings a little, and settles as it is left alone.
  const swing = Math.sin(((Number(now) || 0) - at) / 1000 * 1.3) * sag * 0.12;
  const out = [];
  for (let i = 0; i <= points; i++) {
    const p = i / points, lift = 4 * p * (1 - p);
    out.push({ x: from.x + (to.x - from.x) * p + swing * lift, y: from.y + (to.y - from.y) * p + (sag + swing) * lift });
  }
  return out;
}

// What a moment needs before it can be called: nothing, something chosen, or two of them. The panel asks this
// rather than keeping its own list, so a new moment cannot be added without the panel knowing what it wants.
// Which modes a moment can be called in: the panel hides the rest rather than offering what cannot work.
export const momentWheres = (kind) => known(kind)?.wheres ?? Object.keys(WHERES);
export const momentWorksIn = (kind, where) => momentWheres(kind).includes(where);

export const momentNeeds = (kind) => known(kind)?.needs ?? null;

// A moment can be heard as well as seen. Most of these already have a sound in the module's own library — a
// shockwave is a cave-in's crumble, a pulse is thunder close by — so a GM gets one without choosing, and can pick
// any file instead. `heard` is what it is called in the list below; a GM's own file comes as `sound`.
export const MOMENT_SOUNDS = Object.freeze({
  crumble: { name: "Stone giving way", files: ["assets/sounds/underground/cave-in/cave-in-336023-0.ogg", "assets/sounds/underground/cave-in/cave-in-567249-0.ogg", "assets/sounds/underground/cave-in/cave-in-567250-0.ogg", "assets/sounds/underground/cave-in/cave-in-567251-0.ogg", "assets/sounds/underground/cave-in/cave-in-655368-0.ogg"] },
  thunder: { name: "Thunder, close", files: ["assets/sounds/weather/thunder/thunderClose-194364-0.ogg", "assets/sounds/weather/thunder/thunderClose-361772-0.ogg", "assets/sounds/weather/thunder/thunderClose-501745-0.ogg"] },
  distant: { name: "Thunder, far off", files: ["assets/sounds/weather/thunder/thunderFar-367702-0.ogg", "assets/sounds/weather/thunder/thunderFar-568969-0.ogg"] },
});

// What each moment is heard as when nobody has said otherwise. The quiet ones stay quiet: a grey world makes no
// noise, and a GM who wants one says so.
const HEARD = Object.freeze({ shock: "crumble", dust: "crumble", rumble: "distant", pulse: "thunder" });
export const momentHeardBy = (kind) => HEARD[kind] ?? null;

// A file a GM chose, as far as it may be trusted: this crosses a socket and is handed to the audio engine. A sound
// is a path inside this world's files with an audio extension, and nothing else — no protocol, no climbing out.
const SOUND_FILE = /^[\w./ -]+\.(?:ogg|mp3|wav|webm|m4a|flac|opus)$/i;
export function soundPath(file) {
  const said = String(file ?? "").trim();
  if (!said || said.includes("..") || said.includes("//") || said.startsWith("/")) return null;
  return SOUND_FILE.test(said) ? said : null;
}

/**
 * What a moment sounds like, or null for one that is seen and not heard: { file, volume, at }. `at` is where it is
 * heard from — the place it happened, or null for one that is simply heard. One of a few files is taken at random
 * where the library offers several, so the same moment twice is not the same noise twice.
 */
export function momentSound(call, { random = Math.random } = {}) {
  if (!call || !known(call.kind)) return null;
  const own = soundPath(call.sound);
  const heard = own ? null : MOMENT_SOUNDS[call.heard ?? ""] ?? null;
  const files = heard?.files ?? [];
  const file = own ?? (files.length ? files[Math.min(files.length - 1, Math.floor(clamp(random(), 1) * files.length))] : null);
  if (!file) return null;
  return {
    file,
    volume: Math.min(1, 0.25 + 0.75 * clamp(call.strength)),
    at: call.x !== null ? { x: call.x, y: call.y } : null,
    ids: call.where === "tokens" ? call.ids : [],
  };
}

// A set of moments called as one. Most of what a GM wants is two or three of these together — a roof coming down
// is a rumble and dust and a little grain, and reaching for them one at a time while the table waits is how a good
// idea becomes a fumble. These are the ones worth having to hand; a GM's own are saved beside them.
export const PRESETS = Object.freeze({
  collapse: { name: "The roof comes down", moments: [{ kind: "rumble", strength: 0.6 }, { kind: "dust", strength: 0.6 }, { kind: "grain", strength: 0.25 }] },
  dread: { name: "Something is wrong here", moments: [{ kind: "grey", strength: 0.45, beat: true }, { kind: "vignette", strength: 0.6 }, { kind: "blur", strength: 0.12 }] },
  blow: { name: "A blow lands", moments: [{ kind: "shake", strength: 0.85 }, { kind: "pulse", strength: 0.5, colour: "#c81e1e" }] },
  drowning: { name: "Under the water", moments: [{ kind: "blur", strength: 0.3, beat: true }, { kind: "smear", strength: 0.25 }, { kind: "vignette", strength: 0.55, colour: "#12303a" }] },
  failing: { name: "Their sight is going", moments: [{ kind: "vignette", strength: 0.8, beat: true }, { kind: "grey", strength: 0.7 }, { kind: "split", strength: 0.2 }] },
});

/**
 * The calls a preset makes, ready to be sent. Each is read through momentCall, so a preset out of a world setting
 * cannot carry anything a GM could not have typed; one with nothing usable in it gives nothing at all.
 * Where it happens is the panel's to say, not the preset's: the same set is a roof falling here or over there.
 */
export function presetCalls(preset, { at = 0, where = "screen", x = null, y = null, radius = null, ids = null } = {}) {
  const list = Array.isArray(preset?.moments) ? preset.moments : [];
  return list
    .map((m) => momentCall(m?.kind, { ...m, where: momentWorksIn(m?.kind, where) ? where : "screen", x, y, radius, ids, at }))
    .filter(Boolean);
}

// What is running now, kept as a preset: the moments as they were asked for, without where they happened or when.
export function presetFrom(calls, name = "") {
  const moments = (calls ?? []).filter((c) => c && known(c.kind)).map((c) => {
    const said = { kind: c.kind, strength: c.strength };
    if (c.colour && c.colour !== known(c.kind).colour) said.colour = c.colour;
    if (c.style && c.style !== momentStyleKeys(c.kind)[0]) said.style = c.style;
    if (c.ms !== null) said.ms = c.ms;
    if (c.fade !== null) said.fade = c.fade;
    if (c.beat) said.beat = true;
    return said;
  });
  return moments.length ? { name: String(name || "A moment of my own").slice(0, 60), moments } : null;
}

// The presets there are: the ones kept here and the GM's own, theirs winning a clash of names. Anything that is
// not a preset is left out rather than offered as an empty button.
export function presetsAll(saved = {}) {
  const out = {};
  for (const [key, preset] of Object.entries(PRESETS)) out[key] = preset;
  for (const [key, preset] of Object.entries(saved ?? {})) {
    if (typeof key !== "string" || !key) continue;
    const moments = Array.isArray(preset?.moments) ? preset.moments.filter((m) => known(m?.kind)) : [];
    if (moments.length) out[key] = { name: String(preset.name ?? key).slice(0, 60), moments, own: true };
  }
  return out;
}

// A moment written down, so a GM can keep one they liked: a line that calls it again exactly as it was. What it
// writes is what momentCall reads, less when it happened, which is not part of what the moment is.
export function momentMacro(call, moduleId = "animater") {
  if (!call || !known(call.kind)) return "";
  const said = { kind: call.kind, strength: call.strength, where: call.where };
  if (call.colour) said.colour = call.colour;
  if (call.where === "point") { said.x = call.x; said.y = call.y; said.radius = call.radius; }
  if (call.where === "tokens") said.ids = call.ids;
  if (call.style) said.style = call.style;
  if (call.beat) said.beat = true;
  if (call.ms !== null) said.ms = call.ms;
  if (call.fade !== null) said.fade = call.fade;
  if (call.sound) said.sound = call.sound;
  if ((call.heard ?? null) !== momentHeardBy(call.kind)) said.heard = call.heard ?? "";
  return `game.modules.get("${moduleId}").api.moment(${JSON.stringify(said, null, 2)});`;
}
