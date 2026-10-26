// Blood on the camera lens, for players only: when a player's creature hits an enemy, that enemy's blood splats on
// the player's screen (more for more damage); when the player's own creature is hit, the view closes in (tunnel
// vision) and its own blood splashes the lens, the bloodiest of all. Splats come in from the side the blow came from
// (strong hits fling them across the view), in mixed shapes, run in drips, dry and fade. Every screen decides for itself; nothing here touches Foundry (the host wires it).

import { hpChange } from '../../systems/hp-state.mjs';
import { qualityRank } from '../../core/quality.mjs';

export const LENS_BLOOD = Object.freeze({
  cooldownMs: 600,
  maxAlive: 20,
  // How long a tunnel pulse takes to ease back out, by how hard it closed in (0..1): 2 to 4 s.
  tunnelMs: (level) => Math.round(2000 + 2000 * clamp01(level)),
  // At or under this share of max HP a creature keeps a faint tunnel (and heartbeat).
  lowHp: 0.25,
  // Droplets one splash carries at most (all its splats together), to keep painting a splash cheap.
  maxDroplets: 1100,
});
export const BLOOD_RED = 0x7a0d0d;
// How long a big hit's blood stays at the usual length (heavy, full strength: 2000 + 2500 ms); "Damage lens duration" is set
// in seconds against it.
export const LENS_BASE_SECONDS = 4.5;

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// Heavy or Subtle on this screen: gore off (Hit sounds menu) or quality Off gives none; Subtle gore or Low quality
// force Subtle.
export function lensAmount({ amount, gore, quality }) {
  if (gore === 'off' || qualityRank(quality) === 0) return null;
  if (gore === 'subtle' || qualityRank(quality) === 1) return 'subtle';
  return amount === 'subtle' ? 'subtle' : 'heavy';
}

// What an HP change took, as HP points (a marked track counts the marks).
const lostOf = (before, after) => Math.max(0, before.marked ? after.value - before.value : before.value - after.value);

// Enemy blood by the damage dealt: its share of the target's max HP, a little for the raw number, crits and kills
// heavier. It keeps growing up to about two thirds of max HP: a 3-damage scratch on a 40-HP creature is a few flecks
// (~0.15), a third of its HP a solid splash (~0.55), two thirds or a big crit or a kill a full splatter.
export function dealtStrength({ lost, max, crit = false, down = false }) {
  const share = max > 0 ? lost / max : 0;
  let s = share * 1.4 + Math.min(0.12, (Number(lost) || 0) / 120);
  // A critical hit always looks like one: at least a solid splash, however small the damage.
  if (crit) s = Math.max(0.5, s * 1.25 + 0.08);
  if (down) s += 0.3;
  return Math.round(clamp01(Math.max(0.05, s)) * 1000) / 1000;
}
// The player's own blood: always bloodier than what it deals for the same hit; full at about 60% of max HP.
export function hitStrength({ lost, max, crit = false, down = false }) {
  const share = max > 0 ? lost / max : 0;
  const s = 0.12 + share * 1.45 + (crit ? 0.2 : 0) + (down ? 0.3 : 0);
  return Math.round(clamp01(crit ? Math.max(0.55, s) : s) * 1000) / 1000;
}
// How hard the view closes in on a hit to the player's creature. Subtle tones it down.
export function tunnelLevel({ lost, max, crit = false, down = false }, amount = 'heavy') {
  const share = max > 0 ? lost / max : 0;
  const level = clamp01(0.25 + share * 1.3 + (crit ? 0.2 : 0) + (down ? 0.3 : 0));
  return Math.round((amount === 'subtle' ? level * 0.5 : level) * 1000) / 1000;
}
// The faint tunnel a creature keeps while at or under a quarter of its HP (none when healthy, down or unreadable).
export function lingerLevel(state, amount = 'heavy') {
  if (!state || state.down || !(state.max > 0)) return 0;
  const left = state.marked ? (state.max - state.value) / state.max : state.value / state.max;
  if (left > LENS_BLOOD.lowHp) return 0;
  const level = 0.12 + 0.18 * (1 - left / LENS_BLOOD.lowHp);
  return Math.round((amount === 'subtle' ? level * 0.5 : level) * 1000) / 1000;
}

// "Damage lens shows": which of a player's blows reach their screen, hits taken ('hurt'), hits dealt ('dealt') or both.
// This screen's own choice when set, else the GM's; anything unknown counts as both.
export const LENS_WHO = Object.freeze(['both', 'hurt', 'dealt']);
export function lensWho(world, local = '') {
  return LENS_WHO.includes(local) ? local : LENS_WHO.includes(world) ? world : 'both';
}
export function lensRoleWanted(role, who = 'both') {
  if (role !== 'victim' && role !== 'attacker') return false;
  return who === 'hurt' ? role === 'victim' : who === 'dealt' ? role === 'attacker' : true;
}

// The edge a point lies towards, seen from `from` (the view's middle when not given), or null without a point.
export function edgeToward(point, view, from = null) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const w = view?.width || 1, h = view?.height || 1;
  const o = from && Number.isFinite(from.x) && Number.isFinite(from.y) ? from : { x: w / 2, y: h / 2 };
  const dx = (point.x - o.x) / w, dy = (point.y - o.y) / h;
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'top' : 'bottom');
}

/**
 * Whether this blow paints this screen's lens.
 * role: 'victim' (the player owns the creature hit), 'attacker' (the player owns the creature that hit it), else none.
 * before/after: hp-state.mjs states. bleeds: the creature hit bleeds (Splatter's rules when active, else
 * bleedsBlood). visible: this screen perceives it. screen / attackerScreen: their screen points; view: the window.
 * damageType: the hit's damage type (woundOf), which shapes its splats, scales its blood and shifts its colour.
 * Answers { kind: 'self'|'dealt', strength (blood, 0 none), tunnel (0..1), crit, wound, fromScreen, edge, amount } or null.
 */
export function lensSplashFor({ isGM = false, worldOn = true, localOn = true, quality = 'full', amount = 'heavy', gore = 'full',
  role = null, before = null, after = null, crit = false, bleeds = true, visible = true, hidden = false,
  screen = null, attackerScreen = null, view = { width: 1, height: 1 }, damageType = null } = {}) {
  if (isGM || !worldOn || !localOn || (role !== 'victim' && role !== 'attacker')) return null;
  const look = lensAmount({ amount, gore, quality });
  if (!look || hidden || !visible) return null;
  const change = hpChange(before, after);
  if (!change) return null;
  const hit = { lost: lostOf(before, after), max: Number(after.max) || Number(before.max) || 0, crit: crit === true, down: change.dropped === true };
  const wound = DAMAGE_WOUNDS[damageType] ? damageType : null, scale = DAMAGE_WOUNDS[wound]?.strength ?? 1;
  const blood = (v) => Math.round(clamp01(v * scale) * 1000) / 1000;
  // Low quality: the blood's reaction to its damage type keeps only its static parts (no live marks or motion).
  const still = qualityRank(quality) <= 1 ? { still: true } : {};
  if (role === 'victim') {
    const from = attackerScreen && Number.isFinite(attackerScreen.x) ? { x: attackerScreen.x, y: attackerScreen.y } : null;
    return { kind: 'self', strength: bleeds ? blood(hitStrength(hit)) : 0, tunnel: tunnelLevel(hit, look), crit: hit.crit, wound,
      fromScreen: from, edge: from ? edgeToward(from, view, screen) ?? edgeToward(from, view) : null, amount: look, ...still };
  }
  if (!bleeds) return null;
  const at = screen && Number.isFinite(screen.x) ? { x: screen.x, y: screen.y } : null;
  return { kind: 'dealt', strength: blood(dealtStrength(hit)), tunnel: 0, crit: hit.crit, wound, fromScreen: at,
    edge: at ? edgeToward(at, view, attackerScreen) ?? edgeToward(at, view) : null, amount: look, ...still };
}

// A seeded random source (mulberry32 over a string hash).
function rng(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const EDGES = ['left', 'right', 'top', 'bottom'];
const round = (v) => Math.round(v * 1000) / 1000;
const TAU = Math.PI * 2;
// The splat shapes a splash mixes: an organic blob with drips, an impact crown (an uneven core flinging thin tapering
// fingers that end in drops), a streak thrown across the glass (a bulb trailing a thin ragged tail and beads), a spray
// fan of droplets, a fine mist and a faint translucent smear (big hits only).
export const LENS_SHAPES = Object.freeze(['blob', 'crown', 'streak', 'spray', 'mist', 'smear']);
// Droplets one splat carries at most (a splash in all: LENS_BLOOD.maxDroplets). The renderer paints each splat once
// into a cached sprite, so droplets cost nothing per frame.
const SPLAT_DROPLETS = 90;
// The way into the view from each edge, as an angle (screen y runs down).
const INWARD = { left: 0, right: Math.PI, top: Math.PI / 2, bottom: -Math.PI / 2 };

function pick(random, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let roll = random() * entries.reduce((t, [, w]) => t + w, 0);
  for (const [k, w] of entries) { roll -= w; if (roll <= 0) return k; }
  return entries.at(-1)[0];
}

// What a hit's damage type does to the blood it draws (damage-moments.mjs normalizeDamageType names): which splat mix it
// leaves, how much blood (strength multiplier) and a shift of the blood's colour toward `tint` by `k`. Physical hits
// bleed fully; energy burns, freezes, blackens or sickens the blood and spills less of it.
export const DAMAGE_WOUNDS = Object.freeze({
  slashing: { mix: 'slash' },
  piercing: { mix: 'pierce' },
  bludgeoning: { mix: 'crush' },
  bleed: { mix: 'bleed', strength: 1.15 },
  force: { mix: 'crush', strength: 0.9 },
  sonic: { mix: 'burst', strength: 0.8 },
  electricity: { mix: 'burst', strength: 0.7, tint: 0x1a1010, k: 0.3 },
  fire: { mix: 'scorch', strength: 0.55, tint: 0x2a1208, k: 0.45 },
  cold: { mix: 'frost', strength: 0.8, tint: 0x9fc4d6, k: 0.22 },
  acid: { mix: 'sick', strength: 0.85, tint: 0x8a9a20, k: 0.35 },
  poison: { mix: 'sick', strength: 0.75, tint: 0x5f7a1a, k: 0.3 },
  void: { mix: 'wither', strength: 0.8, tint: 0x1a0f14, k: 0.55 },
  vitality: { mix: 'scorch', strength: 0.55, tint: 0xc9a64a, k: 0.18 },
  mental: { mix: 'faint', strength: 0.45, tint: 0x5a2a6a, k: 0.15 },
  spirit: { mix: 'faint', strength: 0.45, tint: 0xdfe6f2, k: 0.15 },
});
// The damage type a hit wounds with: its main type if it has a look here, else the first of its types that does.
export function woundOf({ type = null, types = [] } = {}) {
  for (const t of [type, ...(types ?? [])]) if (t && DAMAGE_WOUNDS[t]) return t;
  return null;
}
// The shapes each mix favours: the ones it always carries (when strong enough), then what fills the rest. A blade
// leaves long scratches (now and then a claw's set of marks), a point jets of spray (now and then a bite's punctures),
// a blunt blow big bursts. ('claw' and 'bite' are drawn as streak and spray shapes with their own geometry.)
const WOUND_MIX = {
  slash: { always: ['streak', 'streak'], fill: { streak: 1.1, claw: 0.4, spray: 0.6, blob: 0.5, mist: 0.3 } },
  pierce: { always: ['spray', 'spray'], fill: { spray: 1.2, bite: 0.25, mist: 0.5, blob: 0.45, crown: 0.25 } },
  crush: { always: ['mist'], fill: { blob: 1, crown: 0.75, mist: 0.6, spray: 0.2 } },
  bleed: { always: ['blob'], fill: { blob: 1.2, streak: 0.3, mist: 0.25 } },
  burst: { always: ['mist', 'spray'], fill: { mist: 1, spray: 0.8, blob: 0.4 } },
  scorch: { always: [], fill: { blob: 1, mist: 0.4 } },
  frost: { always: ['crown'], fill: { crown: 0.6, blob: 0.8, mist: 0.3 } },
  sick: { always: ['smear'], fill: { blob: 1, mist: 0.5, smear: 0.25 } },
  wither: { always: ['mist'], fill: { blob: 0.8, mist: 0.8 } },
  faint: { always: [], fill: { mist: 1, blob: 0.5 } },
};

// Which shapes this splash holds, the main one first. Heavy strong hits always carry several kinds; Subtle keeps to
// small blobs, small streaks and a light mist.
function shapesFor(random, count, { heavy, sp, self, crit, wound = null }) {
  if (!heavy) {
    const out = ['blob'];
    // Subtle: a claw still scratches, a bite still punctures, a point still sprays, a blunt blow only splats.
    const light = { slash: 'streak', pierce: 'spray', burst: 'spray' }[DAMAGE_WOUNDS[wound]?.mix];
    if (light && count > 1) out.push(light);
    while (out.length < count) out.push(pick(random, ['crush', 'scorch', 'faint'].includes(DAMAGE_WOUNDS[wound]?.mix) ? { blob: 1, mist: 0.5 } : { blob: 1, streak: 0.7, mist: 0.5 }));
    return out;
  }
  const mix = WOUND_MIX[DAMAGE_WOUNDS[wound]?.mix];
  if (mix) {
    // A blunt blow lands as a crown more often; a point as a small blob that sprays.
    const main = mix === WOUND_MIX.crush || mix === WOUND_MIX.frost ? (random() < 0.6 ? 'crown' : 'blob') : (crit || sp >= 0.85) && random() < 0.5 ? 'crown' : 'blob';
    const wanted = mix.always.slice(0, sp >= 0.45 ? mix.always.length : 1);
    const out = [main, ...wanted].slice(0, count);
    while (out.length < count) out.push(pick(random, mix.fill));
    return out;
  }
  const main = (crit || sp >= 0.85) ? (random() < 0.55 ? 'crown' : 'blob') : sp >= 0.5 && random() < 0.3 ? 'crown' : 'blob';
  const wanted = [];
  if (sp >= 0.45) wanted.push('streak');
  if (sp >= 0.6) wanted.push('spray');
  if (sp >= 0.5 || (self && sp >= 0.35)) wanted.push('mist');
  if ((self ? sp >= 0.6 : sp >= 0.85) && random() < 0.6) wanted.push('smear');
  for (let i = wanted.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [wanted[i], wanted[j]] = [wanted[j], wanted[i]]; }
  const out = [main, ...wanted].slice(0, count);
  while (out.length < count) out.push(pick(random, { blob: 1, streak: 0.5 + 0.6 * sp, spray: 0.3 + 0.9 * sp, mist: 0.25 + 0.4 * sp, crown: sp >= 0.6 ? 0.35 : 0 }));
  return out;
}

// Multi-octave noise: a sum of sines with seeded frequencies, amplitudes and phases. `periodic` keeps whole
// frequencies so it closes round a circle (angle in radians); otherwise it runs along t in 0..1.
function noise(random, octaves, periodic = true) {
  const terms = octaves.map(([f0, f1, amp]) => [periodic ? f0 + Math.floor(random() * (f1 - f0 + 1)) : (f0 + random() * (f1 - f0)) * TAU,
    amp * (0.6 + random() * 0.8), random() * TAU]);
  return (x) => terms.reduce((t, [f, amp, ph]) => t + amp * Math.sin(f * x + ph), 0);
}
const bump = (a, at, width) => { const d = Math.atan2(Math.sin(a - at), Math.cos(a - at)) / width; return Math.exp(-d * d); };
// Twice the signed area of a closed polygon: positive runs the way canvas arcs do (angle increasing, y down).
const area = (pts) => pts.reduce((t, p, i) => { const n = pts[(i + 1) % pts.length]; return t + p[0] * n[1] - n[0] * p[1]; }, 0);
const orient = (pts) => (area(pts) < 0 ? pts.reverse() : pts);
const pt = (x, y) => [round(x), round(y)];

// An organic outline (polar, r relative): layered noise and a few uneven lobes, no regular features.
function blobBody(random, { n = 84, base = 1, wobble = 1, lobes = [2, 4], lobeHeight = [0.1, 0.32] } = {}) {
  const wave = noise(random, [[2, 3, 0.1 * wobble], [4, 6, 0.06 * wobble], [7, 11, 0.035 * wobble], [13, 21, 0.02 * wobble], [23, 34, 0.012 * wobble]]);
  const bumps = [];
  for (let k = lobes[0] + Math.floor(random() * (lobes[1] - lobes[0] + 1)); k > 0; k--) {
    bumps.push([random() * TAU, 0.12 + random() * 0.28, lobeHeight[0] + random() * (lobeHeight[1] - lobeHeight[0])]);
  }
  const body = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const r = base * (1 + wave(a) + bumps.reduce((t, [at, w, h]) => t + h * bump(a, at, w), 0));
    body.push({ a: round(a), r: round(Math.min(base * 1.6, Math.max(base * 0.55, r))) });
  }
  return body;
}
const radiusAt = (body, a) => {
  const n = body.length, k = ((a % TAU) + TAU) % TAU / TAU * n, i = Math.floor(k) % n, f = k - Math.floor(k);
  return lerp(body[i].r, body[(i + 1) % n].r, f);
};

// Satellite droplets thrown off a body: power-law falloff from it (many near, few far), mostly tiny, elongated along
// the way they flew. `aims` are preferred directions (finger or lobe angles). Each: dx, dy, r, e (length / width), a.
function satellites(random, n, { from = 1.1, reach = 2.2, size = 0.11, aims = [], aimShare = 0.55 } = {}) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const aimed = aims.length && random() < aimShare;
    const ang = aimed ? aims[Math.floor(random() * aims.length)] + (random() - 0.5) * 0.35 : random() * TAU;
    const u = random(), d = from + Math.min(reach, (Math.pow(1 - u * 0.97, -1 / 1.5) - 1) * 0.55);
    const far = (d - from) / reach;
    const r = (0.006 + size * Math.pow(random(), 2.4)) * (1.15 - far * 0.6);
    out.push({ dx: round(Math.cos(ang) * d), dy: round(Math.sin(ang) * d), r: round(r),
      e: round(1 + Math.min(1.2, far * Math.pow(random(), 0.5) * 1.1 + random() * 0.2)), a: round(ang + (random() - 0.5) * 0.25) });
  }
  return out;
}

// Short tapering fingers off a core, of uneven length, width and bend: thick at the base, wavy (never a straight ray),
// many ending in a round drop at the tip and a few in an elongated drop flung just past it. Each is a closed outline
// wound the same way as the body. lenMax: the longest typical length (relative); cap: the longest any may reach
// past the body edge (relative to r); reach: how far out any may get.
function fingerSet(random, core, count, { lenMax = 0.6, cap = 0.8, reach = 1.7, width = 1, tipChance = 0.75 } = {}) {
  const fingers = [], tips = [], aims = [];
  for (let k = 0; k < count; k++) {
    const a = random() * TAU, r0 = radiusAt(core, a) - 0.08;
    const len = Math.max(0.06, Math.min(reach - r0, cap, 0.1 * lenMax + lenMax * Math.pow(random(), 1.4)));
    // Wide at the root (it grows out of the body), narrowing fast, so it reads as a run of liquid, not a spike.
    const hw0 = (0.05 + 0.05 * random() + 0.07 * len) * width;
    const bend = (random() - 0.5) * 0.7, wave = (random() - 0.5) * 0.12, wf = 1.5 + random() * 2, wp = random() * TAU;
    const edge = noise(random, [[2, 4, 0.16], [5, 9, 0.08]], false);
    const m = 10, upper = [], lower = [];
    const ca = Math.cos(a), sa = Math.sin(a);
    const sideAt = (t) => bend * t * t * len + wave * Math.sin(t * wf * Math.PI + wp) * t * len;
    for (let i = 0; i <= m; i++) {
      const t = i / m, along = r0 + t * len, side = sideAt(t);
      const hw = hw0 * Math.pow(1 - t, 1.6) * (1 + edge(t)) + 0.008;
      const cx = ca * along - sa * side, cy = sa * along + ca * side;
      upper.push(pt(cx - sa * hw, cy + ca * hw));
      lower.push(pt(cx + sa * hw, cy - ca * hw));
    }
    fingers.push(orient([...upper, ...lower.reverse()]));
    aims.push(a);
    const roll = random(), side = sideAt(1);
    if (roll < tipChance * 0.6) {
      // A round drop gathered at the tip.
      const d = r0 + len - 0.01;
      tips.push({ dx: round(ca * d - sa * side), dy: round(sa * d + ca * side), r: round(hw0 * (0.45 + random() * 0.3)), e: round(1 + random() * 0.25), a: round(a) });
    } else if (roll < tipChance) {
      // A drop flung on past the tip, stretched along the finger.
      const d = r0 + len + 0.04 + random() * 0.12;
      tips.push({ dx: round(ca * d - sa * side), dy: round(sa * d + ca * side), r: round(hw0 * (0.4 + random() * 0.35)),
        e: round(1.2 + random() * 0.5), a: round(a + bend * 0.6) });
    }
  }
  return { fingers, tips, aims };
}

// An impact crown: an uneven core flinging many fingers, satellites thrown mostly along them.
function crownGeometry(random, { sp, room }) {
  const core = blobBody(random, { n: 72, base: 0.72, wobble: 1.3, lobes: [3, 6], lobeHeight: [0.08, 0.26] });
  const { fingers, tips, aims } = fingerSet(random, core, 8 + Math.floor(random() * 4) + Math.round(sp * 2), { lenMax: 0.55, cap: 0.85 });
  const cap = Math.min(SPLAT_DROPLETS, room), kept = tips.slice(0, cap);
  const sats = satellites(random, Math.max(0, Math.min(cap - kept.length, 16 + Math.floor(random() * 14) + Math.round(sp * 18))), { from: 1.05, reach: 2.1, size: 0.07, aims });
  return { body: core, fingers, droplets: [...kept, ...sats] };
}

// A scratch along +x from `from` to `to` (relative to r): a thin stroke tapered at both ends (widest a little before
// its middle), nearly straight (`curve`: its centre line's y at t 0..1), with slightly ragged edges, the mark a
// drop dragged across glass leaves. No bulb.
function scratchPath(random, from, to, width, curve) {
  const up = noise(random, [[2, 4, 0.18], [6, 12, 0.12], [14, 24, 0.06]], false), down = noise(random, [[2, 4, 0.18], [6, 12, 0.12], [14, 24, 0.06]], false);
  const m = 22, upper = [], lower = [], peak = 0.3 + random() * 0.2;
  for (let k = 0; k <= m; k++) {
    const t = k / m, x = from + t * (to - from), cy = curve(t);
    // Rises fast to its widest point, then thins slowly to a fine point.
    const hw = width * (t < peak ? Math.sin((t / peak) * Math.PI / 2) : Math.pow(Math.cos(((t - peak) / (1 - peak)) * Math.PI / 2), 0.8)) + 0.006;
    upper.push(pt(x, cy - hw * Math.max(0.4, 1 + up(t))));
    lower.push(pt(x, cy + hw * Math.max(0.4, 1 + down(t))));
  }
  return orient([...upper, ...lower.reverse()]);
}
// A swipe along x: ragged upper and lower edges, tapered ends, and the drag lines a smudge leaves.
function smearPath(random, len) {
  const up = noise(random, [[1, 2, 0.15], [3, 6, 0.1], [8, 14, 0.05]], false), down = noise(random, [[1, 2, 0.15], [3, 6, 0.1], [8, 14, 0.05]], false);
  const m = 24, upper = [], lower = [];
  for (let k = 0; k <= m; k++) {
    const t = k / m, x = (t * 2 - 1) * len, end = Math.pow(Math.sin(Math.PI * (0.03 + t * 0.94)), 0.7);
    upper.push(pt(x, -end * (0.75 + up(t))));
    lower.push(pt(x, end * (0.7 + down(t))));
  }
  return orient([...upper, ...lower.reverse()]);
}
// Dark pooled patches where blood gathers thickest, inside a body of relative radius `within`.
function pools(random, n, within, at = [0, 0]) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = random() * TAU, d = Math.sqrt(random()) * within * 0.55;
    out.push({ dx: round(at[0] + Math.cos(a) * d), dy: round(at[1] + Math.sin(a) * d), r: round(within * (0.25 + random() * 0.3)) });
  }
  return out;
}

// One splat's geometry by its shape, relative to r; droplets limited to `room`.
function geometry(shape, random, { heavy, sp, room, dripsOk, height, r, marks = false, bite = false }) {
  const g = { body: [], droplets: [], drips: [], pools: [] };
  const take = (n) => Math.max(0, Math.min(n, room, SPLAT_DROPLETS));
  const drips = (n, dxSpread, lengthScale) => {
    for (let k = 0; k < n; k++) {
      g.drips.push({ dx: round((random() - 0.5) * dxSpread), w: round(0.06 + random() * 0.06),
        length: Math.round(Math.min(height * 0.16, r * (0.7 + random() * 1.5) * lengthScale)),
        delayMs: Math.round(200 + random() * 500), runMs: Math.round(1600 + random() * 1800) });
    }
  };
  if (shape === 'blob') {
    g.body = blobBody(random);
    // A few short stubby runs off its edge, and drops thrown mostly the same ways.
    const f = fingerSet(random, g.body, heavy ? 3 + Math.floor(random() * 5) : 1 + Math.floor(random() * 3), { lenMax: 0.26, cap: 0.4, reach: 1.75, width: 1.3, tipChance: 0.5 });
    g.fingers = f.fingers;
    const tips = f.tips.slice(0, take(f.tips.length));
    g.droplets = [...tips, ...satellites(random, Math.max(0, take(heavy ? 10 + Math.floor(random() * 14) + Math.round(sp * 10) : 3 + Math.floor(random() * 6)) - tips.length),
      { from: 1.1, reach: 1.8, size: 0.09, aims: f.aims })];
    g.pools = pools(random, 2 + Math.floor(random() * 3), 1);
    if (dripsOk) drips(heavy ? Math.floor(random() * 3) : 1, 1.1, heavy ? 1 : 0.6);
  } else if (shape === 'crown') {
    const c = crownGeometry(random, { sp, room });
    g.body = c.body; g.fingers = c.fingers; g.droplets = c.droplets;
    g.pools = pools(random, 2 + Math.floor(random() * 2), 0.72);
    if (dripsOk) drips(heavy ? Math.floor(random() * 3) : 1, 1, heavy ? 1 : 0.6);
  } else if (shape === 'streak') {
    // Scratches: one long stroke and often one or two thinner ones beside it, nearly parallel, like something dragged
    // across the glass; a few fine flecks along them.
    const len = heavy ? 4 + random() * 3 + sp * 1.5 : 3 + random() * 2;
    const bend = (random() - 0.5) * 0.05 * len, curve = (t) => bend * t * t;
    const width = 0.16 + random() * 0.1;
    g.path = scratchPath(random, 0, len, width, curve);
    g.fingers = [];
    if (marks) {
      // Claw marks: three or four nearly parallel scratches side by side, each its own length and start, fanning a little.
      const n = 2 + Math.floor(random() * 2), gap = 0.45 + random() * 0.25, fan = (random() - 0.5) * 0.06;
      for (let k = 1; k <= n; k++) {
        const off = k * gap * (1 + (random() - 0.5) * 0.25), start = (random() - 0.3) * len * 0.25, end = start + len * (0.7 + random() * 0.35);
        g.fingers.push(scratchPath(random, start, end, width * (0.75 + random() * 0.3), (t) => off + fan * k * len * t + curve(t)));
      }
    }
    for (let k = marks ? 0 : random() < 0.75 ? 1 + Math.floor(random() * 2) : 0; k > 0; k--) {
      const off = (random() < 0.5 ? -1 : 1) * (0.25 + random() * 0.45), start = random() * len * 0.3, end = start + len * (0.45 + random() * 0.45);
      const tilt = (random() - 0.5) * 0.04 * len;
      g.fingers.push(scratchPath(random, start, Math.min(len * 1.05, end), width * (0.35 + random() * 0.35), (t) => off + tilt * t + curve(t)));
    }
    for (let k = take(2 + Math.floor(random() * 5)); k > 0; k--) {
      const x = random() * len * 1.1;
      g.droplets.push({ dx: round(x), dy: round(curve(Math.min(1, x / len)) + (random() - 0.5) * 0.6), r: round(0.03 + random() * 0.07), e: round(1.2 + random() * 1.5), a: round((random() - 0.5) * 0.15) });
    }
    if (dripsOk && random() < 0.5) drips(1, 0.6, 0.6);
  } else if (shape === 'spray' && bite) {
    // A bite: two arcs of punctures facing each other (the upper and lower teeth), each drop stretched toward the
    // middle, and a few small drops thrown off.
    for (const side of [-1, 1]) {
      const n = take(5 + Math.floor(random() * 4)), span = 1.6 + random() * 0.5, cy = side * (0.55 + random() * 0.2), rad = 1.25 + random() * 0.3;
      for (let k = 0; k < n; k++) {
        const a = -span / 2 + (k / Math.max(1, n - 1)) * span + (random() - 0.5) * 0.08;
        const x = Math.sin(a) * rad, y = cy - side * (Math.cos(a) * rad - rad) * 0.55;
        g.droplets.push({ dx: round(x), dy: round(y), r: round(0.09 + random() * 0.08), e: round(1.2 + random() * 0.6), a: round(Math.atan2(-y, -x)) });
      }
    }
    for (let k = take(4 + Math.floor(random() * 6)); k > 0; k--) {
      const ang = random() * TAU, d = 1.6 + random() * 1.4;
      g.droplets.push({ dx: round(Math.cos(ang) * d), dy: round(Math.sin(ang) * d * 0.7), r: round(0.03 + random() * 0.05), e: round(1 + random() * 0.8), a: round(ang) });
    }
    g.droplets = g.droplets.slice(0, take(g.droplets.length));
  } else if (shape === 'spray') {
    // A fan thrown along +x: dense near the source, thinning out with distance (power law), stretched as it flew.
    const spread = 0.35 + random() * 0.45 + sp * 0.25, n = take(Math.round((heavy ? 24 : 12) + random() * 18 + sp * 26));
    for (let k = 0; k < n; k++) {
      const ang = (random() - 0.5) * spread * (0.4 + random() * 0.6) * 2, dist = 0.2 + 3.9 * Math.pow(random(), 1.8);
      g.droplets.push({ dx: round(Math.cos(ang) * dist), dy: round(Math.sin(ang) * dist),
        r: round((0.02 + 0.13 * Math.pow(random(), 3.2)) * (1.1 - dist / 6)), e: round(1.1 + random() * 0.8 + dist * 0.12), a: round(ang + (random() - 0.5) * 0.15) });
    }
  } else if (shape === 'mist') {
    // A fine faint cloud: specks, densest in the middle.
    const n = take(Math.round(heavy ? 40 + random() * 30 + sp * 20 : 16 + random() * 10));
    for (let k = 0; k < n; k++) {
      const ang = random() * TAU, dist = Math.min(2.4, Math.sqrt(-2 * Math.log(1 - random() * 0.98)) * 0.75);
      g.droplets.push({ dx: round(Math.cos(ang) * dist), dy: round(Math.sin(ang) * dist * 0.8), r: round(0.015 + 0.05 * Math.pow(random(), 2.2)), e: round(1 + random() * 0.5), a: round(ang) });
    }
  } else if (shape === 'smear') {
    const len = 2.6 + random() * 1.6;
    g.path = smearPath(random, len);
    g.streaks = [];
    for (let k = 7 + Math.floor(random() * 7); k > 0; k--) {
      const x0 = -len * (0.3 + random() * 0.7);
      g.streaks.push({ y: round((random() - 0.5) * 1.3), w: round(0.02 + random() * 0.07), x0: round(x0), x1: round(Math.min(len * 0.95, x0 + len * (0.6 + random() * 1.2))), o: round(0.3 + random() * 0.7) });
    }
    if (dripsOk) drips(Math.floor(random() * 3), len * 1.4, 0.7);
  }
  return g;
}

// How the blood itself reacts to the damage type that drew it, over its life, on top of its colour and shapes: fire
// cooks it (bubbles fizzing at its edges, a wisp of steam, singed crackled edges, drips stopping short), electricity
// fries it (crackled rim, no drips, sparks jumping between splats as they land), cold freezes it (drips stop dead, a
// frosty rim and sparkles; it thaws near the end and the drips run on), acid eats growing holes in it, poison spreads
// an oily sheen and creeps, void withers it (black, veined, shrinking and curling), vitality burns it off in light,
// sonic shakes it, force slams it flat, mental ghosts it, spirit thins it into a pale wisp, a bleed keeps running and a
// blunt blow lands heavier. Each splat carries it as plain data (`react`): what its sprites paint (static) and the few
// tiny marks drawn live, timed in ms from its landing. k: how strong (a crit more, Subtle less); still (Low quality):
// only the static parts, no live marks or motion.
export const BLOOD_REACTIONS = Object.freeze(['fire', 'electricity', 'cold', 'acid', 'poison', 'void', 'vitality', 'sonic', 'force', 'mental', 'spirit', 'bleed', 'bludgeoning']);

// Points round a splat's edge (relative to r, its own frame): its body, its path, else its bigger droplets.
function rimOf(splat) {
  if (splat.body?.length) return splat.body.map((p) => [Math.cos(p.a) * p.r, Math.sin(p.a) * p.r]);
  if (splat.path?.length) return splat.path;
  const drops = (splat.droplets ?? []).filter((d) => d.r >= 0.04);
  return (drops.length ? drops : splat.droplets ?? []).map((d) => [d.dx, d.dy]);
}
// A point inside the blood: `depth` 0 at its middle, 1 at its edge (a path's: between its two sides).
function inside(random, splat, rim, depth) {
  if (!rim.length) return [0, 0];
  const i = Math.floor(random() * rim.length), [x, y] = rim[i];
  if (splat.path?.length) {
    const [ox, oy] = rim[rim.length - 1 - i], mx = (x + ox) / 2, my = (y + oy) / 2;
    return [lerp(mx, x, depth), lerp(my, y, depth)];
  }
  if (!splat.body?.length) return [x, y];
  return [x * depth, y * depth];
}
const count = (random, n, k) => Math.max(0, Math.round(n * k * (0.7 + random() * 0.6)));
// Tiny bubbles fizzing up and popping, at `depth` (share of the way out), born within `by` ms, each `ms` long.
function bubbles(random, splat, rim, n, { depth = [0.82, 1], by = 650, ms = [110, 260], size = [0.035, 0.075] } = {}) {
  const drops = !splat.body?.length && !splat.path?.length;
  return Array.from({ length: n }, () => {
    const [dx, dy] = inside(random, splat, rim, lerp(depth[0], depth[1], random()));
    return { dx: round(dx), dy: round(dy), r: round(lerp(size[0], size[1], Math.pow(random(), 1.5)) * (drops ? 0.6 : 1)),
      t0: Math.round(random() * by), ms: Math.round(lerp(ms[0], ms[1], random())) };
  }).sort((a, b) => a.t0 - b.t0);
}
// Jagged lines from the edge inward (singed or fried crackle, frost needles, veins; painted into a sprite): flat
// [x, y, ...] each.
function crackles(random, rim, n, { len = [0.12, 0.32], bend = 0.5 } = {}) {
  const out = [];
  for (let k = 0; k < n && rim.length; k++) {
    const [x, y] = rim[Math.floor(random() * rim.length)], d = Math.hypot(x, y) || 1;
    let a = Math.atan2(-y, -x) + (random() - 0.5) * bend, px = x * 0.97, py = y * 0.97;
    const steps = 3 + Math.floor(random() * 3), step = lerp(len[0], len[1], random()) * Math.min(1, d) / steps, pts = [round(px), round(py)];
    for (let s = 0; s < steps; s++) {
      a += (random() - 0.5) * 1.1;
      px += Math.cos(a) * step; py += Math.sin(a) * step;
      pts.push(round(px), round(py));
    }
    out.push(pts);
  }
  return out;
}
// A jagged spark from (x0, y0) to (x1, y1): flat [x, y, ...], its middle points thrown sideways.
function jag(random, x0, y0, x1, y1, n, disp) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / len, ny = (x1 - x0) / len, pts = [round(x0), round(y0)];
  for (let i = 1; i < n; i++) {
    const t = i / n, o = (random() - 0.5) * 2 * disp * len * Math.sin(Math.PI * t);
    pts.push(round(lerp(x0, x1, t) + nx * o), round(lerp(y0, y1, t) + ny * o));
  }
  pts.push(round(x1), round(y1));
  return pts;
}
// Twinkling glints (cold's crystals, vitality's light): where, how big (relative), when and how fast they twinkle.
function sparkles(random, splat, rim, n, { from = 150, to = 2400, depth = [0.4, 1] } = {}) {
  return Array.from({ length: n }, () => {
    const [dx, dy] = inside(random, splat, rim, lerp(depth[0], depth[1], random()));
    return { dx: round(dx), dy: round(dy), s: round(0.06 + random() * 0.08), ph: round(random() * TAU), hz: round(0.8 + random() * 1.4),
      t0: Math.round(from * (0.5 + random())), t1: Math.round(to * (0.7 + random() * 0.3)) };
  });
}

// One splat's reaction to its damage type (null: none). Its drips may be changed in place; `short`: the view's short
// side (px). Deterministic by `random`.
function reactionOf(type, random, splat, { k, still, short }) {
  if (!BLOOD_REACTIONS.includes(type)) return null;
  const rim = rimOf(splat), life = splat.lifeMs, live = !still, body = !!(splat.body?.length || splat.path?.length);
  const react = { type, k: round(k) };
  if (still) react.still = true;
  const rot = splat.rotation ?? 0, toScreen = (x, y) => [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
  if (type === 'fire') {
    // Cooks: dries dark within a second or so, singed and crackled at the edge; fizzes at first, a wisp or two of steam.
    react.dry = [0.1, 0.38];
    react.cracks = crackles(random, rim, body ? 5 + count(random, 5, k) : 0, { len: [0.18, 0.42] });
    if (live) {
      react.bubbles = bubbles(random, splat, rim, count(random, body ? 26 : 6, k), { by: 850, ms: [180, 380], size: [0.03, 0.08] });
      const wisps = splat.r >= short * 0.025 && splat.shape !== 'mist' ? Math.min(2, count(random, 1.3, k)) : 0;
      react.wisps = Array.from({ length: wisps }, () => {
        const [x, y] = toScreen(...inside(random, splat, rim, 0.3 + random() * 0.6));
        return { x: round(x), y: round(y), t0: Math.round(60 + random() * 450), ms: Math.round(1100 + random() * 700), h: round(0.9 + random() * 0.9 * k), sway: round((random() - 0.5) * 0.8) };
      });
    }
    for (const d of splat.drips) { d.stop = round(0.18 + random() * 0.22); d.runMs = Math.round(d.runMs * 0.55); }
  } else if (type === 'electricity') {
    // Fries at once: a dark crackled rim and no drips; a brief sizzle in its shine; sparks off its edges as it lands
    // (and between neighbours: arcsBetween).
    react.dry = [0.01, 0.16];
    react.cracks = crackles(random, rim, body ? 6 + count(random, 5, k) : 0, { len: [0.08, 0.2], bend: 0.9 });
    splat.drips = [];
    if (live) {
      react.flickerMs = Math.round(320 + 160 * k);
      react.sparks = Array.from({ length: body ? Math.min(3, 1 + count(random, 1, k)) : 0 }, () => {
        const [x, y] = rim[Math.floor(random() * rim.length)] ?? [1, 0], a = Math.atan2(y, x) + (random() - 0.5) * 0.9, l = 0.25 + random() * 0.4 * k;
        return { pts: jag(random, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 4, 0.35), t0: Math.round(random() * 140), ms: Math.round(60 + random() * 80) };
      });
    }
  } else if (type === 'cold') {
    // Freezes: hardly dries; a frosty rim and crystals glinting; its drips stop dead (frozen beads) and, as it thaws
    // near the end, run on a little before it fades.
    react.dry = [0.55, 0.95];
    // The frost on bodies of blood (on a mist it would only fog the view).
    if (body) react.frost = true;
    react.freezeMs = Math.round(500 + random() * 300);
    react.thaw = round(0.7 + random() * 0.06);
    react.needles = crackles(random, rim, body ? 6 + count(random, 6, k) : 0, { len: [0.06, 0.16], bend: 1.6 });
    if (live) react.sparkles = sparkles(random, splat, rim, count(random, body ? 5 : 2, k), { to: life * react.thaw });
    for (const d of splat.drips) {
      if (live) { d.freezeMs = Math.round(d.delayMs + 260 + random() * 420); d.thawMs = Math.round(life * react.thaw + random() * 150); }
      else d.stop = round(0.2 + random() * 0.2);
    }
  } else if (type === 'acid') {
    // Eats holes: ragged holes open in the thicker blood and grow; it bubbles at first, all over.
    if (live) {
      const n = splat.shape === 'blob' || splat.shape === 'crown' ? 1 + count(random, 3, k) : splat.shape === 'smear' || splat.shape === 'streak' ? count(random, 1.2, k) : 0;
      react.holes = Array.from({ length: n }, () => {
        const [dx, dy] = inside(random, splat, rim, splat.path ? 0.2 + random() * 0.4 : 0.15 + random() * 0.5);
        return { dx: round(dx), dy: round(dy), r: round((splat.path ? 0.12 : 0.13) + random() * 0.15 * k), t0: Math.round(150 + random() * 900), ms: Math.round(1600 + random() * 1600),
          lobes: Array.from({ length: 3 }, () => [round((random() - 0.5) * 0.9), round((random() - 0.5) * 0.9), round(0.45 + random() * 0.4)]) };
      });
      react.bubbles = bubbles(random, splat, rim, count(random, body ? 12 : 5, k), { depth: [0.25, 1], by: 1200, ms: [200, 420], size: [0.05, 0.1] });
    }
  } else if (type === 'poison') {
    // An oily sheen shimmering on it, and it creeps slowly outward.
    react.sheen = true;
    if (live) { react.creep = round(0.08 + 0.06 * k); react.shimmerMs = Math.round(1400 + random() * 600); }
  } else if (type === 'void') {
    // Withers: darkens toward black with dark veins through it, shrinking and curling a little.
    react.dry = [0.04, 0.42];
    react.veins = body ? crackles(random, rim, 3 + count(random, 3, k), { len: [0.35, 0.7], bend: 0.7 }) : [];
    if (live) { react.shrink = round(0.1 + 0.06 * k); react.curl = round((random() < 0.5 ? -1 : 1) * (0.1 + 0.08 * k)); }
  } else if (type === 'vitality') {
    // Burns off in light: its edges glow gold for a moment, faint light glints in it, it pales and fades sooner.
    react.dry = [0.08, 0.4];
    react.fade = 0.42;
    if (live) {
      if (body) react.glow = { rise: 120, hold: Math.round(350 + 200 * k), out: 800 };
      react.sparkles = sparkles(random, splat, rim, count(random, body ? 4 : 2, k), { from: 100, to: life * 0.6, depth: [0.2, 1] });
    }
  } else if (type === 'sonic') {
    // Shakes as it lands: a quick decaying wobble of its size and turn; a mist or spray jitters.
    if (live) {
      react.wobble = { amp: round(0.07 + 0.05 * k), spin: round(0.05 + 0.04 * k), hz: round(10 + random() * 5), ms: Math.round(260 + 120 * k) };
      if (splat.shape === 'mist' || splat.shape === 'spray') react.jitter = round(2 + 2 * k);
    }
  } else if (type === 'force' || type === 'bludgeoning') {
    // Slams flat: lands with a sharp outward push past its size, then settles; force leaves crisp edges.
    if (type === 'force') react.crisp = true;
    if (live) react.slam = { over: round((type === 'force' ? 0.13 : 0.06) * k), ms: type === 'force' ? 200 : 240 };
  } else if (type === 'mental') {
    // A faint double: an offset ghost of it wobbling back into place.
    if (live) react.ghost = { d: round(0.22 + 0.12 * k), a: round(random() * TAU), ms: Math.round(800 + 300 * k), alpha: round(0.45 + 0.12 * k) };
  } else if (type === 'spirit') {
    // Thins into a pale, soft, translucent wisp that drifts up as it fades.
    react.ethereal = true;
    react.dry = [0.1, 0.5];
    react.fade = 0.45;
    if (live) react.rise = round(0.18 + 0.12 * k);
  } else if (type === 'bleed') {
    // Keeps running: more and longer drips, some starting late.
    const ok = (splat.shape === 'blob' || splat.shape === 'crown' || splat.shape === 'smear') && splat.r >= short * 0.012;
    for (let n = ok ? 1 + count(random, 1.2, k) : 0; n > 0; n--) {
      splat.drips.push({ dx: round((random() - 0.5) * 1.1), w: round(0.06 + random() * 0.06),
        length: Math.round(Math.min(short * 0.24, splat.r * (1 + random() * 1.6) * (0.8 + 0.4 * k))),
        delayMs: Math.round(200 + random() * life * 0.45), runMs: Math.round(2400 + random() * 2000) });
    }
    for (const d of splat.drips) d.length = Math.round(Math.min(short * 0.26, d.length * 1.2));
  }
  return react;
}

// Sparks jumping between nearby fried splats as they land (kept on the first of each pair: px from its middle, screen
// axes, as it is not turned with it).
function arcsBetween(random, splats, k, short) {
  let left = Math.round(4 + 4 * k);
  for (let i = 0; i < splats.length && left > 0; i++) {
    const a = splats[i];
    if (!a.react || a.react.still || a.shape === 'mist') continue;
    let best = null, far = Math.max(short * 0.2, a.r * 3);
    for (let j = 0; j < splats.length; j++) {
      const b = splats[j];
      if (j === i || b.shape === 'mist') continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y) - (a.r + b.r) * 0.75;
      if (d > 4 && d < far) { far = d; best = b; }
    }
    if (!best) continue;
    const ang = Math.atan2(best.y - a.y, best.x - a.x), ux = Math.cos(ang), uy = Math.sin(ang);
    const x0 = ux * a.r * 0.75, y0 = uy * a.r * 0.75, x1 = best.x - a.x - ux * best.r * 0.75, y1 = best.y - a.y - uy * best.r * 0.75;
    const t0 = Math.max(a.delayMs ?? 0, best.delayMs ?? 0) + Math.round(20 + random() * 120);
    a.react.arcs = [{ pts: jag(random, x0, y0, x1, y1, 7 + Math.floor(random() * 4), 0.16), t0, ms: Math.round(70 + random() * 70), w: round(0.8 + 0.5 * k) }];
    // A second strike now and then.
    if (random() < 0.35 * k) a.react.arcs.push({ pts: jag(random, x0, y0, x1, y1, 7, 0.2), t0: t0 + Math.round(90 + random() * 80), ms: 60, w: round(0.7 + 0.3 * k) });
    left--;
  }
}

/**
 * The splats of one splash, seeded. amount 'heavy'|'subtle'; strength 0..1 (count, size, spread, drips, lifetime);
 * kind 'self' adds more and bigger splats, laid around the view; crit makes it messier; origin / edge: where it
 * comes in (a seeded edge when neither is given). The main splat lands nearest the blow; strong hits reach well into
 * the view and fling secondary splats across it, away from the blow; weak hits and Subtle stay near the edges.
 * Each splat: shape (LENS_SHAPES), x, y, r (px), rotation (thrown shapes point along +x), color, tone (its own
 * shade of the colour), delayMs, lifeMs, body [{a, r}] (outline, r relative; empty for path shapes), path [[x, y]]
 * (streak/smear outline, relative), fingers [[[x, y]]] (crown: closed tapering outlines, relative), streaks (smear),
 * droplets [{dx, dy, r, e (length / width), a (angle)}] (relative), pools [{dx, dy, r}] (dark thick patches),
 * drips [{dx, w, length (px), delayMs, runMs}], highlight {dx, dy, r, k}, grain (texture seed).
 */
export function lensSplats(seed, { amount = 'heavy', width = 1, height = 1, origin = null, edge = null, strength = 1, kind = 'dealt', color = BLOOD_RED, crit = false, wound = null, still = false } = {}) {
  const random = rng(`${seed}:lens`), s = clamp01(strength), heavy = amount !== 'subtle', self = kind === 'self';
  const short = Math.min(width, height);
  if (s <= 0) return [];
  let count = 1 + Math.round(13 * Math.pow(s, 1.2) * (0.8 + random() * 0.35)) + (self ? 2 : 0);
  count = heavy ? Math.min(self ? 16 : 14, Math.max(1, count)) : Math.min(3, Math.max(1, Math.ceil(count / 2)));
  if (heavy && s >= 0.85) count = Math.max(9, count);
  // How messy it gets: the strength, a little more for a crit.
  const sp = clamp01(s + (crit === true ? 0.15 : 0));
  // The main body's radius at most, growing faster near the top: a light hit stays small, a 60% hit or a big crit
  // throws a body about a fifth of the view's short side across (its crown fingers reach to about a third).
  // A heavy critical hit throws much bigger blood (in place of a film over the lens): half as big again, and two more
  // big bodies land beside the main one.
  const bigCrit = heavy && crit === true;
  const rMax = short * (heavy ? 0.015 + 0.12 * Math.pow(s, 1.4) : 0.008 + 0.022 * s) * (self && heavy ? 1.1 : 1) * (bigCrit ? 1.45 : 1);
  // Heavy blood holds and fades about a quarter sooner than it used to (it is in the way of play); Subtle is short anyway.
  const life = heavy ? 2000 + 2500 * s : 2000 + 1000 * s;
  const mainEdge = edge && EDGES.includes(edge) ? edge : null;
  const shapes = shapesFor(random, count, { heavy, sp, self, crit: crit === true, wound: DAMAGE_WOUNDS[wound] ? wound : null });
  // Share of secondary splats flung anywhere across the view (none for weak hits or Subtle).
  const scatter = heavy ? 0.75 * smooth(0.3, 0.95, sp) : 0;
  const nearReach = 0.1 + 0.22 * sp;
  const radial = self && heavy, cx = width / 2, cy = height / 2;
  const base = mainEdge ? INWARD[mainEdge] + Math.PI : random() * TAU; // self: the side the blow came from
  const clampX = (v) => Math.min(width * 0.98, Math.max(width * 0.02, v)), clampY = (v) => Math.min(height * 0.98, Math.max(height * 0.02, v));
  let mainAlong = null, budget = LENS_BLOOD.maxDroplets;
  const splats = [];
  for (let i = 0; i < count; i++) {
    const big = bigCrit && (i === 1 || i === 2);
    // A claw's marks are scratches in a set, a bite's punctures a spray laid in two arcs.
    const want = big ? (random() < 0.5 ? 'blob' : 'crown') : shapes[i], main = i === 0;
    const shape = want === 'claw' ? 'streak' : want === 'bite' ? 'spray' : want;
    const size = main ? 0.85 + random() * 0.15 : big ? 0.65 + random() * 0.25
      : shape === 'blob' ? 0.35 + random() * 0.55 : shape === 'crown' ? 0.5 + random() * 0.35
      : shape === 'streak' ? (heavy ? 0.18 + random() * 0.16 : 0.3 + random() * 0.25)
      : shape === 'spray' ? 0.6 + random() * 0.4 : shape === 'mist' ? 0.55 + random() * 0.35 : 0.45 + random() * 0.25;
    const r = rMax * size * (shape === 'crown' ? 1.12 : 1);
    let x, y, dir;
    if (heavy) {
      // Centre first: the impact lands around the middle of the view (leaning a little toward the blow's side), the
      // rest cluster round it and spread wider the harder the hit, thrown outward from the impact.
      const lean = mainEdge ? INWARD[mainEdge] + Math.PI : 0, pull = mainEdge ? 0.1 : 0;
      if (main) {
        const ang = random() * TAU, rho = Math.pow(random(), 0.8) * 0.16;
        x = clampX(cx + (Math.cos(lean) * pull + Math.cos(ang) * rho) * cx);
        y = clampY(cy + (Math.sin(lean) * pull + Math.sin(ang) * rho) * cy);
        mainAlong = [x, y];
        dir = mainEdge ? INWARD[mainEdge] : random() * TAU;
      } else {
        const [mx, my] = mainAlong, ang = random() * TAU;
        const rho = big ? 0.2 + random() * 0.25 : lerp(0.12, 0.85, Math.pow(random(), lerp(2.2, 1.1, sp)));
        x = clampX(mx + Math.cos(ang) * rho * cx);
        y = clampY(my + Math.sin(ang) * rho * cy);
        dir = Math.hypot(x - mx, y - my) < 1 ? ang : Math.atan2(y - my, x - mx);
      }
    } else if (radial) {
      // Own blood: around the view, centred on the blow's side when known; strong hits close in on the middle.
      const ang = main ? base + (mainEdge ? (random() - 0.5) * 0.8 : 0)
        : base + (mainEdge ? (random() - 0.5) * (Math.PI * 1.1 + sp * Math.PI * 0.9) : random() * TAU);
      const rho = Math.min(0.96, main ? lerp(0.85, 0.45, sp) + (random() - 0.5) * 0.2 : lerp(0.95, 0.3, sp * random()) + (random() - 0.5) * 0.1);
      x = clampX(cx + Math.cos(ang) * rho * cx);
      y = clampY(cy + Math.sin(ang) * rho * cy);
      dir = mainEdge ? INWARD[mainEdge] : Math.atan2(y - cy, x - cx);
    } else {
      const side = mainEdge ?? EDGES[Math.floor(random() * 4)];
      const horizontal = side === 'top' || side === 'bottom';
      const dim = horizontal ? width : height, perp = horizontal ? height : width;
      const far = !main && random() < scatter;
      let along;
      if (far) along = 0.06 + random() * 0.88;
      else if (origin && mainEdge) {
        const o = Math.min(1, Math.max(0, (horizontal ? origin.x : origin.y) / dim));
        along = 0.5 + (o - 0.5) * 1.2 + (random() - 0.5) * (heavy ? 0.3 : 0.16);
      } else if (!main && mainEdge && mainAlong !== null) along = mainAlong + (random() - 0.5) * 0.5;
      else along = 0.08 + random() * 0.84;
      along = Math.min(0.96, Math.max(0.04, along));
      if (main) mainAlong = along;
      const depth = !heavy ? Math.pow(random(), 1.4) * 0.12 * short
        : (far ? 0.05 + random() * 0.9 : main ? Math.pow(random(), 0.9) * lerp(0.06, 0.45, sp) : Math.pow(random(), 1.4) * nearReach) * perp;
      const a = along * dim;
      x = side === 'left' ? depth : side === 'right' ? width - depth : a;
      y = side === 'top' ? depth : side === 'bottom' ? height - depth : a;
      if (heavy) { x = clampX(x); y = clampY(y); }
      // Thrown away from where it came in: from the impact point on the edge to here.
      const at = (mainEdge ? mainAlong : along) * dim;
      const sx = side === 'left' ? 0 : side === 'right' ? width : at, sy = side === 'top' ? 0 : side === 'bottom' ? height : at;
      dir = main || Math.hypot(x - sx, y - sy) < 1 ? INWARD[side] : Math.atan2(y - sy, x - sx);
    }
    const thrown = shape === 'streak' || shape === 'spray' || shape === 'smear';
    const rotation = thrown ? dir + (random() - 0.5) * 0.6 : random() * TAU;
    const g = geometry(shape, random, { heavy, sp, room: budget, height, r, marks: want === 'claw', bite: want === 'bite',
      dripsOk: ((shape === 'blob' || shape === 'crown') && r >= short * 0.02) || (shape === 'streak' && r >= short * 0.008) || (shape === 'smear' && r >= short * 0.02) });
    budget -= g.droplets.length;
    const splat = { shape, x: Math.round(x), y: Math.round(y), r: Math.round(r * 10) / 10, rotation: round(rotation), color,
      tone: round(heavy ? 0.78 + random() * 0.3 : 0.85 + random() * 0.2),
      delayMs: main ? 0 : Math.round(random() * (thrown ? 110 : 60)), lifeMs: Math.round(life * (0.92 + random() * 0.16)),
      body: g.body, droplets: g.droplets, drips: g.drips, pools: g.pools,
      // A small irregular glint on the thick part (k: its outline, relative).
      highlight: { dx: round(-0.2 - random() * 0.15), dy: round(-0.22 - random() * 0.15), r: round(0.1 + random() * 0.08),
        k: Array.from({ length: 7 }, () => round(0.55 + random() * 0.6)) },
      // A seed of its own for the renderer's fine texture.
      grain: Math.floor(random() * 1e9) };
    if (g.fingers) splat.fingers = g.fingers;
    if (g.path) splat.path = g.path;
    if (g.streaks) splat.streaks = g.streaks;
    // How this blood reacts to its damage type (its own seeded stream, so the shapes above stay as they were).
    const react = reactionOf(wound, rng(`${seed}:react:${i}`), splat, { k: !heavy ? 0.55 : crit === true ? 1.35 : 1, still: still === true, short });
    if (react) splat.react = react;
    splats.push(splat);
  }
  if (wound === 'electricity' && !still) arcsBetween(rng(`${seed}:arcs`), splats, !heavy ? 0.55 : crit === true ? 1.35 : 1, short);
  return splats;
}

/**
 * Where a splat is in its life: scale (splash-in), alpha, dry 0..1, highlight 0..1, drips (px each), done; and its
 * reaction's live part (react: lensSplats): sx, sy (a squash on its own axes), spin (added turn), ox, oy (px moved),
 * ghost ({ dx, dy, alpha } or null), aura (0..1: its frost, glow or sheen), t (ms since it landed), age (ms).
 */
export function splatState(splat, ageMs) {
  const t = ageMs - (splat.delayMs ?? 0), p = ageMs / splat.lifeMs, re = splat.react, live = re && !re.still;
  // How far each drip has run: cooked ones stop short; frozen ones stop dead and run on once thawed.
  const dripAt = (d, age) => {
    let run = age - d.delayMs;
    if (d.freezeMs != null && age > d.freezeMs) run = d.freezeMs - d.delayMs + Math.max(0, age - (d.thawMs ?? Infinity)) * 0.8;
    const k = clamp01(run / d.runMs);
    return d.length * Math.min(d.stop ?? 1, 1 - (1 - k) * (1 - k));
  };
  const rest = { sx: 1, sy: 1, spin: 0, ox: 0, oy: 0, ghost: null, aura: 0, t, age: ageMs };
  if (ageMs >= splat.lifeMs) return { scale: 1, alpha: 0, dry: 1, highlight: 0, drips: splat.drips.map((d) => dripAt(d, Infinity)), done: true, ...rest };
  if (t < 0) return { scale: 0, alpha: 0, dry: 0, highlight: 1, drips: splat.drips.map(() => 0), done: false, ...rest };
  let scale = t >= 80 ? 1 : 0.55 + 0.45 * (1 - Math.pow(1 - t / 80, 3));
  const [d0, d1] = re?.dry ?? [0.3, 0.75], dry = smooth(d0, d1, p), fade = re?.fade ?? 0.7;
  let highlight = 1 - dry * 0.9;
  const st = { ...rest, scale, alpha: p < fade ? 1 : 1 - smooth(fade, 1, p), dry, highlight, drips: splat.drips.map((d) => dripAt(d, ageMs)), done: false };
  if (!re) return st;
  // Static parts of a reaction still show at Low quality: the poison's sheen, steady.
  if (re.sheen) st.aura = live && re.shimmerMs ? smooth(0, 500, t) * (0.55 + 0.45 * Math.sin((t / re.shimmerMs) * TAU)) : 0.6;
  if (!live) return st;
  if (re.slam) {
    // Out past its size in a few frames, a bounce back under, settled within a quarter second.
    const { over, ms } = re.slam;
    scale = t < 45 ? 0.5 + (0.5 + over) * Math.sqrt(t / 45) : 1 + over * Math.exp(-(t - 45) / (ms * 0.35)) * Math.cos(((t - 45) / ms) * Math.PI * 1.6);
  }
  if (re.wobble) {
    const { amp, spin, hz, ms } = re.wobble, e = Math.exp(-t / ms), w = Math.sin((t / 1000) * hz * TAU);
    st.sx = 1 + amp * e * w;
    st.sy = 1 - amp * e * w;
    st.spin = spin * e * Math.sin((t / 1000) * hz * 0.7 * TAU + 1);
  }
  if (re.jitter) {
    const e = Math.exp(-t / 380), g = (splat.grain ?? 0) % 97;
    st.ox = re.jitter * e * Math.sin(t * 0.11 + g);
    st.oy = re.jitter * e * Math.cos(t * 0.13 + g * 1.7);
  }
  if (re.creep) scale *= 1 + re.creep * smooth(0, 0.9, p);
  if (re.shrink) { const w = smooth(0.12, 0.95, p); scale *= 1 - re.shrink * w; st.spin += re.curl * w; }
  if (re.rise) { const w = smooth(0.15, 1, p); st.oy -= re.rise * splat.r * w; scale *= 1 + 0.1 * w; }
  if (re.ghost) {
    const { d, a, ms, alpha } = re.ghost, e = 1 - smooth(0, ms, t), wob = Math.cos((t / 1000) * 5.5 * TAU);
    if (e > 0.01) st.ghost = { dx: Math.cos(a) * d * splat.r * e * (0.6 + 0.4 * wob), dy: Math.sin(a) * d * splat.r * e * (0.6 + 0.4 * wob), alpha: alpha * e };
  }
  if (re.frost) st.aura = smooth(0, re.freezeMs ?? 600, t) * (1 - smooth(re.thaw, re.thaw + 0.12, p));
  if (re.glow) { const { rise, hold, out } = re.glow; st.aura = smooth(0, rise, t) * (1 - smooth(rise + hold, rise + hold + out, t)); }
  // A sizzle: the fried shine flickers as it lands.
  if (re.flickerMs && t < re.flickerMs) {
    const n = Math.floor(t / 34), h = Math.abs(Math.sin(n * 91.7 + (splat.grain ?? 0) * 0.013)) % 1;
    st.highlight = highlight * (0.25 + 1.1 * h);
  }
  st.scale = scale;
  return st;
}

/** A tunnel pulse ({ bornAt, level, lifeMs }) at an age: closes in over ~150 ms, then eases back out. */
export function tunnelState(pulse, ageMs) {
  if (ageMs >= pulse.lifeMs) return { level: 0, done: true };
  if (ageMs < 0) return { level: 0, done: false };
  const rise = Math.min(1, ageMs / 150), fall = 1 - smooth(0.1, 1, ageMs / pulse.lifeMs);
  return { level: pulse.level * rise * fall, done: false };
}

/**
 * Adds a splash to the lens: at most one per cooldown and maxAlive splats alive (oldest go first). A hit on the
 * player's own creature pulses the tunnel even inside the cooldown. Answers { state, added } (state is unchanged,
 * the same object, when nothing was added).
 */
// duration: how much longer (or shorter) the blood stays than usual ("Damage lens duration"); its drying, fading and
// reactions stretch with it (they follow each splat's life), and the tunnel eases out up to twice as slowly.
export function admitSplash(state, splash, { now, seed, width, height, color = BLOOD_RED, duration = 1 }) {
  if (!splash) return { state, added: 0 };
  const k = Math.min(6, Math.max(0.4, Number(duration) || 1));
  const pulse = splash.tunnel > 0 ? [{ bornAt: now, level: splash.tunnel, lifeMs: Math.round(LENS_BLOOD.tunnelMs(splash.tunnel) * Math.min(2, k)) }] : [];
  const cooling = now - state.lastAt < LENS_BLOOD.cooldownMs;
  if ((cooling || !(splash.strength > 0)) && !pulse.length) return { state, added: 0 };
  const live = liveSplats(state, now);
  const fresh = cooling ? [] : lensSplats(seed, { amount: splash.amount, width, height, origin: splash.fromScreen, edge: splash.edge,
    strength: splash.strength, kind: splash.kind, crit: splash.crit === true, wound: splash.wound ?? null, still: splash.still === true,
    // Energy shifts the blood's colour (burned darker, frozen paler, sickened green, blackened).
    color: DAMAGE_WOUNDS[splash.wound]?.tint != null ? mix(color ?? BLOOD_RED, DAMAGE_WOUNDS[splash.wound].tint, DAMAGE_WOUNDS[splash.wound].k) : color }).map((s) => ({ ...s, bornAt: now, lifeMs: Math.round(s.lifeMs * k) }));
  return {
    state: { lastAt: fresh.length ? now : state.lastAt, splats: [...live.splats, ...fresh].slice(-LENS_BLOOD.maxAlive), pulses: [...live.pulses, ...pulse] },
    added: fresh.length,
  };
}
/** The lens without splats and pulses that have run out. */
export function liveSplats(state, now) {
  return { ...state, splats: state.splats.filter((s) => now - s.bornAt < s.lifeMs), pulses: (state.pulses ?? []).filter((p) => now - p.bornAt < p.lifeMs) };
}

export function cssColor(color, alpha = 1) {
  const c = Number(color) >>> 0;
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.round(alpha * 1000) / 1000})`;
}
// A colour darkened (f < 1) or mixed toward another.
export const shade = (color, f) => {
  const c = Number(color) >>> 0, k = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (k((c >> 16) & 255) << 16) | (k((c >> 8) & 255) << 8) | k(c & 255);
};
export const mix = (a, b, t) => {
  const ch = (c, s) => (c >> s) & 255, m = (s) => Math.round(lerp(ch(a, s), ch(b, s), clamp01(t)));
  return (m(16) << 16) | (m(8) << 8) | m(0);
};
