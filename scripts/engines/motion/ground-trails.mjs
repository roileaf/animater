// Ground trails: what a creature's feet carry and drop beyond the floor it is on. Feet that walked through water, mud
// or snow leave wet, muddy or white prints on the next floor for a few strides, fainter each stride; a badly hurt
// creature drips blood now and then; rain splashes under every step (and wets the prints on soft ground) and falling
// snow dusts every step. Pure logic: movement-feel.mjs lays the specs as it lays a floor's own marks, so they share its
// budgets and are drawn only where the creature is seen. Seeded by the token id and stride, the same on every screen.

import { tracksFor } from './movement-feel.mjs';

// What each floor leaves on the feet: how many strides it lasts on another floor, and the prints it makes there.
export const CARRY = Object.freeze({
  // Wet prints: a dark, translucent darkening of the floor, drying in about 8 s.
  water: Object.freeze({ strides: 6, color: 0x18232b, alpha: 0.3, life: 8000, hold: 0.3 }),
  // Muddy prints: brown, lingering about 12 s.
  mud: Object.freeze({ strides: 8, color: 0x4a3420, alpha: 0.48, life: 12000, hold: 0.45 }),
  // Snow knocked off the feet: faint white, gone in about 5 s.
  snow: Object.freeze({ strides: 4, color: 0xf2f6fb, alpha: 0.4, life: 5000, hold: 0.3 }),
});
// The gaits whose feet leave separate prints (movement-feel.mjs TRACKS); grooves, smears, unknown and incorporeal
// creatures carry nothing.
const PRINTING = new Set(['boots', 'talons', 'dragon', 'paws', 'hooves', 'claws', 'legs']);
const PRINT_SIZE = 0.085;

// One stride on `floor` with what the feet carry now (`state`: null or {floor, left}): the load after it, and the
// carried print it makes ({floor, strength 1 .. 1/strides}) or null. Walking in a carried floor fills the feet again;
// another one empties them a stride at a time.
export function carryStep(state, floor) {
  if (CARRY[floor]) return { state: { floor, left: CARRY[floor].strides }, print: null };
  if (!state || !(state.left > 0) || !CARRY[state.floor]) return { state: null, print: null };
  const print = { floor: state.floor, strength: state.left / CARRY[state.floor].strides };
  return { state: state.left > 1 ? { floor: state.floor, left: state.left - 1 } : null, print };
}

const printPart = (look, alpha) => ({ color: look.color, alpha, size: PRINT_SIZE, life: look.life, hold: look.hold });
const printBase = (part) => ({ kind: 'print', vx: 0, vy: 0, alpha: part.alpha, delay: 0, life: part.life, rotation: 0, spin: 0, grow: 0, hold: part.hold });
// The creature's own prints (its gait's shape and cadence) in a look's colour; tail drags and grooves left out.
function prints(gait, part, at, { grid = 100, width = grid } = {}) {
  if (!PRINTING.has(gait)) return [];
  return tracksFor(gait, part, printBase(part), at, { grid, width }).filter((p) => p.kind === 'print');
}
// The carried prints of one stride (`print` from carryStep) at `at` ({x, y, heading, index}).
export function carriedPrints(print, at, { grid = 100, width = grid, gait = 'boots' } = {}) {
  const look = print && CARRY[print.floor];
  if (!look) return [];
  const alpha = look.alpha * Math.max(0, Math.min(1, print.strength ?? 1));
  return prints(gait, printPart(look, alpha), at, { grid, width }).map((p) => ({ ...p, carried: print.floor }));
}

// Same text, same numbers.
function rng(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Blood. Creatures without it (PF2e/SF2e traits, D&D creature types) and things that are not creatures never bleed.
const BLOODLESS = new Set(['construct', 'elemental', 'ooze', 'incorporeal', 'skeleton', 'spirit', 'object']);
const NOT_CREATURES = new Set(['hazard', 'loot', 'party', 'army', 'group', 'encounter', 'environment', 'vehicle']);
const lower = (v) => String(v ?? '').toLowerCase();
export function bleedsBlood(actor) {
  if (!actor || NOT_CREATURES.has(lower(actor.type))) return false;
  const sys = actor.system ?? {};
  const traits = sys.traits?.value;
  for (const t of (Array.isArray(traits) || traits instanceof Set ? [...traits] : [])) if (BLOODLESS.has(lower(t))) return false;
  return !BLOODLESS.has(lower(sys.details?.type?.value ?? sys.details?.type));
}
export const BLOOD_COLOR = 0x7a0d0d;
// A Splatter blood colour flag ("#rrggbb" or "#rrggbbaa") as a number, else the default dark red.
export function bloodColor(flag) {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(flag ?? '').trim());
  return m ? parseInt(m[1], 16) : BLOOD_COLOR;
}
// One drop in each run of three strides, at a seeded place in the run: about every third stride, never in step.
export function bloodDue(seed, index) {
  const i = Math.max(0, Math.trunc(Number(index) || 0)), block = Math.floor(i / 3);
  return i % 3 === Math.floor(rng(`${seed}:${block}:blood`)() * 3) % 3;
}
// How big a creature's marks are against a Medium one's (its width in squares, eased), as puffsFor sizes floor marks.
const sized = (grid, width) => grid * Math.pow(Math.min(8, Math.max(0.4, (Number(width) || grid) / (grid || 100))), 0.85);
// A small dark splat beside the feet and a droplet or two around it, lasting about 20 s.
export function bloodDrop(at, { seed = '', grid = 100, width = grid, color = BLOOD_COLOR } = {}) {
  const random = rng(`${seed}:${at.index ?? 0}:drop`), heading = at.heading ?? 0, across = heading + Math.PI / 2;
  const side = (random() - 0.5) * width * 0.3;
  const x = at.x + Math.cos(across) * side, y = at.y + Math.sin(across) * side;
  const base = { vx: 0, vy: 0, delay: 0, spin: 0, grow: 0, life: 20000, hold: 0.6, lasting: true, color }, u = sized(grid, width);
  const out = [{ ...base, kind: 'blob', x, y, radius: u * (0.03 + random() * 0.02), rotation: random() * Math.PI * 2, alpha: 0.85 }];
  const bits = 1 + Math.floor(random() * 2);
  for (let i = 0; i < bits; i++) {
    const a = random() * Math.PI * 2, d = u * (0.05 + random() * 0.05);
    out.push({ ...base, kind: 'drop', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, radius: u * (0.008 + random() * 0.006), rotation: 0, alpha: 0.8 });
  }
  return out;
}

// The scene's weather on the ground: 'rain', 'snow' or null. Foundry's own scene weather (CONFIG.weatherEffects ids)
// first, else FXMaster's particle effects (its scene flag `effects`, each with a `type`): any snow is snow, else any rain
// (or hail) is rain.
const SCENE_WEATHER = { rain: 'rain', rainstorm: 'rain', snow: 'snow', blizzard: 'snow' };
const FXMASTER_WEATHER = { rain: 'rain', rainsimple: 'rain', raintop: 'rain', hail: 'rain', snow: 'snow', snowstorm: 'snow', blizzard: 'snow' };
export function sceneWeather({ weather, fxmaster } = {}) {
  const own = SCENE_WEATHER[lower(weather)];
  if (own) return own;
  const effects = Array.isArray(fxmaster) ? fxmaster : fxmaster && typeof fxmaster === 'object' ? Object.values(fxmaster) : [];
  let found = null;
  for (const effect of effects) {
    const kind = FXMASTER_WEATHER[lower(effect?.type)];
    if (kind === 'snow') return 'snow';
    if (kind) found = kind;
  }
  return found;
}
// Rain on these floors leaves wet prints (darkening the floor's own prints, and printing dirt).
const WET_FLOORS = new Set(['sand', 'mud', 'dirt']);
const WET = { color: 0x16222b, alpha: 0.22, life: 8000, hold: 0.3 };
// What the weather adds to one stride on `floor`: rain a few splashing drops and a small ring, and wet prints on soft
// ground; snow a light white dusting kicked up (not on water, and snow floors already throw their own powder).
export function weatherMarks(weather, floor, at, { seed = '', grid = 100, width = grid, gait = 'boots' } = {}) {
  if (!weather || gait === 'none') return [];
  const random = rng(`${seed}:${at.index ?? 0}:${weather}`), back = (at.heading ?? 0) + Math.PI, out = [];
  const base = { vx: 0, vy: 0, delay: 0, spin: 0, rotation: 0 }, u = sized(grid, width), reach = Math.sqrt(u / grid);
  if (weather === 'rain') {
    out.push({ ...base, kind: 'ring', color: 0xcfe3f2, x: at.x, y: at.y, radius: u * 0.1, alpha: 0.55, life: 500, grow: 1.2 });
    for (let i = 0; i < 3; i++) {
      const a = random() * Math.PI * 2, speed = grid * reach * (0.15 + random() * 0.2);
      out.push({ ...base, kind: 'drop', color: 0xd8eaf6, x: at.x, y: at.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        radius: u * (0.018 + random() * 0.012), alpha: 0.7, life: 400, hop: u * 0.04, grow: 0, delay: Math.round(random() * 40) });
    }
    if (WET_FLOORS.has(floor)) out.push(...prints(gait, { ...WET, size: PRINT_SIZE }, at, { grid, width }).map((p) => ({ ...p, wet: true })));
  } else if (weather === 'snow') {
    if (floor === 'water' || floor === 'snow') return [];
    for (let i = 0; i < 3; i++) {
      const a = back + (random() - 0.5) * Math.PI * 1.4, speed = grid * reach * (0.08 + random() * 0.14);
      out.push({ ...base, kind: 'puff', color: 0xf3f6fa, x: at.x + (random() - 0.5) * u * 0.1, y: at.y + (random() - 0.5) * u * 0.1,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, radius: u * (0.06 + random() * 0.03), alpha: 0.5, life: 750, grow: 1 + random() * 0.5,
        delay: Math.round(random() * 50) });
    }
  }
  return out;
}

// A cold place, where breath shows: the scene flag (true or false) decides when set; else snow falling, or a snow or
// ice floor underfoot.
export function isCold({ weather, floor, flag } = {}) {
  if (flag === true || flag === false) return flag;
  return weather === 'snow' || floor === 'snow' || floor === 'ice';
}

// Walking marks the ground (a step, a crawl, a climb, wading); a burrower is under it, a swimmer in the water and a
// jumper in the air.
const walking = (kind, floor) => kind === 'step' || kind === 'crawl' || kind === 'climb' || (kind === 'swim' && floor !== 'water');
// Per token what its feet carry, and each stride's extra marks. `tracked()`, `blood()` switch the carried prints and the
// blood drops; `weather(feet, token)` is the weather where it walks ('rain', 'snow' or null). A token view carries
// `bleeding` (badly hurt with blood to lose) and `bloodColor`.
export function createGroundTrails({ tracked = () => true, blood = () => true, weather = () => null } = {}) {
  const loads = new Map();
  return {
    marks(token, feet, floor, opts = {}, kind = 'step') {
      const id = token?.id;
      if (!walking(kind, floor)) { if (kind === 'burrow') loads.delete(id); return []; }
      const gait = opts.gait ?? token.gait ?? 'boots', out = [];
      const step = carryStep(loads.get(id) ?? null, floor);
      if (step.state) loads.set(id, step.state); else loads.delete(id);
      if (step.print && tracked() !== false) out.push(...carriedPrints(step.print, feet, { ...opts, gait }));
      if (token.bleeding && blood() !== false && bloodDue(opts.seed ?? id, feet.index)) {
        out.push(...bloodDrop(feet, { seed: opts.seed ?? id, grid: opts.grid, width: opts.width, color: token.bloodColor ?? BLOOD_COLOR }));
      }
      const sky = weather(feet, token);
      if (sky) out.push(...weatherMarks(sky, floor, feet, { ...opts, gait }));
      return out;
    },
    forget(id) { loads.delete(id); },
    clear() { loads.clear(); },
  };
}
