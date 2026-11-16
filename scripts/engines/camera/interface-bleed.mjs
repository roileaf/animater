// The interface bleeds. Blood on the camera and the tunnel at low health already exist (engines/camera/lens-blood.mjs,
// lens-wounds.mjs) — and they stop dead at the edge of the map. The moment a player looks at their sheet, the chat log
// or the hotbar, the world they were in is not there any more. This is the same wound let out across Foundry's own
// furniture, so a character who is dying is dying everywhere that player is looking.
//
// Six looks, each its own switch, because they are not one feature: a GM who wants the quiet darkening at the edges
// almost certainly does not want the whole window shuddering. Two are off until asked for — the tunnel, because the
// canvas already tunnels and doing it twice is too much, and the shudder, because it is the loudest thing here and
// the one somebody will feel in their stomach.
//
// Readability beats atmosphere. Blood over a damage roll nobody can read is a bug. Anywhere the shell marks as
// needing to stay readable, blood lands smaller and thinner, and never at full strength.
//
// Pure: no Foundry, no DOM. Everything is fractions of the window, so the shell places them and owns the clock.

export const BLEED_LOOKS = Object.freeze({
  edge: { name: "Wound at the edges", hint: "The whole interface darkens and reddens at its outer edge as a character goes down.", on: true },
  glass: { name: "Blood on the glass", hint: "Blood thrown across everything, the chat log and the hotbar too, running and drying where it lands.", on: true },
  drain: { name: "Colour drains", hint: "The colour pulls out of Foundry's own panels as a character nears death.", on: true },
  beat: { name: "Heartbeat", hint: "A slow double thump in the darkened edges while a character is badly hurt.", on: true },
  tunnel: { name: "Tunnel", hint: "The interface closes in from every side. The map already does this on its own; this is it everywhere else.", on: false },
  shudder: { name: "Shudder", hint: "The whole window jolts when something lands. The loudest of these, and the first to turn off.", on: false },
});

export const BLEED_KEYS = Object.freeze(Object.keys(BLEED_LOOKS));
// Which are on before anybody chooses.
export const BLEED_DEFAULTS = Object.freeze(Object.fromEntries(BLEED_KEYS.map((k) => [k, BLEED_LOOKS[k].on])));

// Nothing at all above this share of health: being hurt is not being in trouble.
export const BLEED_FROM = 0.5;
// The heart starts at this much hurt — which, the way hurtLevel counts, is a quarter of health left: the same
// quarter the canvas already beats at (lens-blood LENS_BLOOD.lowHp), so the two agree.
export const BLEED_HEART_AT = 0.5;
// Blood lands at this share of its strength where the shell asked for things to stay readable.
export const BLEED_KEPT_CLEAR = 0.34;
// Most splats one splash may leave, and most alive at once: a window papered in blood is nobody's atmosphere.
export const BLEED_SPLATS_MOST = 10;
export const BLEED_ALIVE_MOST = 26;
// How long blood stays, in milliseconds: a glancing blow, and a character going down.
export const BLEED_MS = Object.freeze({ hit: 9000, heavy: 13000 });
// How long a shudder takes.
export const BLEED_SHUDDER_MS = 500;

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
// Said at all, and a number: `null`, `undefined` and "" all become 0 through Number(), and a health of "nobody
// said" read as 0 is a character the interface would declare dead.
const said = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

/**
 * How far gone this character is, 0 to 1. Nothing until they are bloodied, then it climbs the rest of the way;
 * unconscious or dying is all the way, whatever the number says, because a character at 0 of 60 and one at 0 of 200
 * are in exactly the same trouble.
 */
export function hurtLevel({ hp = null, max = null, unconscious = false } = {}) {
  if (unconscious === true) return 1;
  if (!said(hp) || !said(max)) return 0;
  const now = Number(hp), most = Number(max);
  if (most <= 0) return 0;
  const share = clamp01(now / most);
  if (share >= BLEED_FROM) return 0;
  return clamp01((BLEED_FROM - share) / BLEED_FROM);
}

/**
 * What the shell should be showing this moment, given how hurt the character is, how strongly the GM set it, and
 * which looks are on. Every number is ready to use: nothing here needs multiplying again.
 *   edge, tunnel, drain  0 to 1
 *   beatMs               how long one heartbeat takes, 0 when there is none
 */
export function bleedFrame({ hurt = 0, strength = 1, looks = BLEED_DEFAULTS } = {}) {
  const h = clamp01(hurt), f = Math.max(0, Math.min(1.5, num(strength, 1)));
  const on = (key) => looks?.[key] === true;
  const scaled = clamp01(h * f);
  return {
    edge: on("edge") ? scaled : 0,
    tunnel: on("tunnel") ? scaled : 0,
    // The colour never goes all the way out, at any strength: an unreadable sheet helps nobody.
    drain: on("drain") ? clamp01(Math.min(0.78, h * f * 0.78)) : 0,
    // Faster the worse it gets, the way the canvas heartbeat already quickens.
    beatMs: on("beat") && h >= BLEED_HEART_AT ? Math.round(1020 - 220 * h) : 0,
  };
}

// Same text, same numbers: two screens showing the same blow show the same blood.
function rng(seed) {
  let h = Math.imul(Math.floor(num(seed, 0) * 4294967296) ^ 0x9e3779b1, 0x85ebca6b) | 0;
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inAny = (x, y, areas) => areas.some((a) => x >= num(a?.x) && x <= num(a?.x) + num(a?.w) && y >= num(a?.y) && y <= num(a?.y) + num(a?.h));

/**
 * One splash of blood across the window. Everything is a fraction of the window (x, y, w, h) or degrees (rot), so
 * the shell only has to place them.
 *   from      "left" or "right": the side the blow came from, which is the side it is thrown from
 *   heavy     a character going down, rather than taking a hit
 *   strength  the GM's setting, 0 to 1.5
 *   seed      so every screen draws the same splash
 *   keepClear areas that must stay readable, as fractions {x, y, w, h} — the chat log, usually
 * Each splat carries its own run (`drip`) and its own spray (`spots`), and says how long it has (`ms`).
 */
export function bleedSplats({ from = "left", heavy = false, strength = 1, seed = 0, keepClear = [] } = {}) {
  const f = Math.max(0, Math.min(1.5, num(strength, 1)));
  if (f <= 0) return [];
  const clear = Array.isArray(keepClear) ? keepClear.filter((a) => a && Number.isFinite(Number(a.w))) : [];
  const random = rng(seed);
  const want = Math.round((heavy ? 9 : 5) * Math.max(0.4, Math.min(1, f)));
  const n = Math.max(1, Math.min(BLEED_SPLATS_MOST, want));
  const ms = heavy ? BLEED_MS.heavy : BLEED_MS.hit;
  const out = [];
  for (let i = 0; i < n; i++) {
    const big = random() < (heavy ? 0.4 : 0.22);
    // Thrown across the window from the side it came from; a heavy blow throws it further.
    const reach = heavy ? 0.78 : 0.5;
    const across = random() * reach;
    const x = clamp01(from === "right" ? 1 - across : across);
    const y = clamp01(0.08 + random() * 0.8);
    const kept = clear.length > 0 && inAny(x, y, clear);
    const scale = f * (kept ? BLEED_KEPT_CLEAR : 1);
    const w = (big ? 0.028 : 0.011) * (0.5 + random()) * Math.max(0.5, scale);
    const spots = [];
    for (let s = 0, many = 1 + Math.round(random() * (big ? 3 : 2)); s < many; s++) {
      spots.push({
        dx: -0.18 + random() * 1.28, dy: -0.16 + random() * 1.26,
        w: 0.12 + random() * 0.3, round: 34 + random() * 38,
      });
    }
    out.push({
      x, y, w, h: w * (0.72 + random() * 0.5),
      rot: random() * 360,
      round: [0, 1, 2, 3].map(() => Math.round(34 + random() * 38)),
      big, kept,
      // Where blood must stay readable it lands thinner as well as smaller.
      opacity: clamp01(kept ? 0.52 * f : Math.min(1, 0.82 + 0.18 * f)),
      drip: { at: 0.26 + random() * 0.4, w: Math.max(0.0022, w * 0.26), h: w * (1.1 + random() * 3.2) },
      spots,
      ms,
    });
  }
  return out;
}

// How hard the window jolts and which way, `t` of the way through the shudder (0 to 1). Dies away rather than
// stopping, the same idea as engines/camera/camera-shake.mjs, in pixels at strength 1.
export function bleedShudder(t, strength = 1) {
  const p = clamp01(t), f = Math.max(0, Math.min(1.5, num(strength, 1)));
  const left = Math.pow(1 - p, 2) * f;
  return {
    x: left * 7 * Math.sin(p * 47) + 0,
    y: left * 4 * Math.sin(p * 61 + 1.1) + 0,
    rot: left * 0.32 * Math.sin(p * 53 + 0.4) + 0,
    left,
  };
}

// Which looks are on, from whatever the settings gave back: anything unsaid keeps its default, anything unknown is
// dropped, so an old world that has never heard of a look still gets a sensible answer.
export function bleedLooks(saved = {}) {
  const out = {};
  for (const key of BLEED_KEYS) {
    const said = saved?.[key];
    out[key] = said === true || said === false ? said : BLEED_DEFAULTS[key];
  }
  return out;
}

// Whether anything at all would be drawn: the shell builds no layer when the answer is no.
export const bleedWanted = (looks) => BLEED_KEYS.some((k) => looks?.[k] === true);
