// Idle life: tokens on screen idle subtly. Living creatures breathe (a ~1% scale pulse,
// 3.5–5 s, phase seeded by the token id so they breathe out of step); fliers bob up and
// down. Played through ConditionBody as its two lowest-priority kinds, so any condition
// treatment wins and one-off motions make it step aside. Local only: nothing is saved.

import { isFlying } from './movement-feel.mjs';

export const IDLE_CAP = 40;
const PREFIX = 'animater-idle:';
export const HOVER_PERIOD = 2.4;

// Creatures that do not breathe (PF2e/SF2e traits, D&D creature types).
// Oozes, plants and fungi, elementals, swarms and spirits have no lungs to heave or breath to show either.
const NO_BREATH = new Set(['construct', 'undead', 'object', 'ooze', 'plant', 'fungus', 'elemental', 'swarm', 'spirit', 'incorporeal']);
// Actor types that are not creatures at all (PF2e/SF2e hazards, loot and parties; D&D
// vehicles, groups and encounters; Daggerheart environments). Vehicles may still hover.
const NOT_CREATURES = new Set(['hazard', 'loot', 'party', 'army', 'group', 'encounter', 'environment']);
// Down, defeated or held: no idle at all.
const STILL = new Set(['prone', 'unconscious', 'dead', 'dying', 'defeated', 'deathmove', 'paralyzed', 'petrified', 'sleeping', 'asleep']);

const list = (v) => (v == null ? [] : typeof v === 'string' ? [v] : Array.from(v));
const lower = (v) => String(v ?? '').toLowerCase();

export function breathes(actor) {
  if (!actor) return false;
  const type = lower(actor.type);
  if (NOT_CREATURES.has(type) || type === 'vehicle') return false;
  const sys = actor.system ?? {};
  const traits = list(sys.traits?.value).map(lower);
  if (traits.some((t) => NO_BREATH.has(t))) return false;
  const kind = lower(sys.details?.type?.value ?? sys.details?.type);
  if (NO_BREATH.has(kind)) return false;
  return true;
}

// Which idle a token shows: 'idle-hover', 'idle-breathe' or null.
export function idleKind({ actor, statuses = [], defeated = false, elevation = 0, base = 0, movementAction } = {}) {
  if (!actor || defeated) return null;
  const s = list(statuses).map(lower);
  if (s.some((x) => STILL.has(x))) return null;
  if (NOT_CREATURES.has(lower(actor.type))) return null;
  // Flight is the fly movement action or a flying status; standing high on a platform is not flying.
  if (isFlying({ action: movementAction, statuses: s })) return 'idle-hover';
  return breathes(actor) ? 'idle-breathe' : null;
}

// A stable hash of the token id in [0, 1).
export function idlePhase(id) {
  let h = 2166136261;
  for (const c of String(id ?? '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h / 4294967296;
}
// Seconds per breath: each token its own 3.5–5 s at Medium, slower for bigger bodies (a Gargantuan one about 1.8×, a
// Tiny one about 0.6×). `squares` is the token's width in grid squares.
const BREATH_SIZE = [[0.5, 0.6], [1, 1], [3, 1.5], [5, 1.8]];
export function breathSize(squares = 1) {
  const s = Math.min(5, Math.max(0.5, Number(squares) || 1));
  for (let i = 1; i < BREATH_SIZE.length; i++) {
    const [a, fa] = BREATH_SIZE[i - 1], [b, fb] = BREATH_SIZE[i];
    if (s <= b) return fa + (fb - fa) * ((s - a) / (b - a));
  }
  return BREATH_SIZE.at(-1)[1];
}
export const breathPeriod = (id, squares = 1) => (3.5 + 1.5 * idlePhase(`${id}:period`)) * breathSize(squares);

// Tokens overlapping the view rectangle, nearest the middle first, at most `cap`.
export function pickIdle(tokens, view, cap = IDLE_CAP) {
  if (!view) return tokens.slice(0, cap);
  const cx = view.x + view.width / 2, cy = view.y + view.height / 2;
  return tokens
    .filter((t) => t.x + t.w > view.x && t.x < view.x + view.width && t.y + t.h > view.y && t.y < view.y + view.height)
    .map((t) => ({ t, d: (t.x + t.w / 2 - cx) ** 2 + (t.y + t.h / 2 - cy) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, cap)
    .map(({ t }) => t);
}

// Keeps ConditionBody's idle records in step with the tokens on screen. Every Foundry call
// is injected: tokens() the placeables, view() the visible world rectangle, statuses(token),
// defeated(token), levelBase(token) the floor elevation of the token's level.
export class IdleLife {
  constructor({ body, tokens = () => [], view = () => null, enabled = () => true, statuses = () => [], defeated = () => false, levelBase = () => 0, cap = IDLE_CAP, strength = () => 1, kinds = () => ({ breathe: true, hover: true }) } = {}) {
    Object.assign(this, { body, tokens, view, enabled, statuses, defeated, levelBase, cap, strength, kinds });
    this.shown = new Map(); // record name → kind
  }
  wanted() {
    const want = new Map();
    if (!this.enabled()) return want;
    // Breathing and hovering switch separately (world settings Idle breathing, Fliers hover).
    let allowed = { breathe: true, hover: true };
    try { allowed = { breathe: true, hover: true, ...(this.kinds() ?? {}) }; } catch { /* both */ }
    const placed = [];
    for (const token of this.tokens() ?? []) {
      try {
        if (!token || token.destroyed || !token.visible || token.document?.hidden) continue;
        const doc = token.document ?? {};
        const kind = idleKind({ actor: token.actor, statuses: this.statuses(token), defeated: this.defeated(token),
          elevation: doc.elevation, base: this.levelBase(token), movementAction: doc.movementAction });
        if (kind === 'idle-breathe' && allowed.breathe === false) continue;
        if (kind === 'idle-hover' && allowed.hover === false) continue;
        if (kind) placed.push({ token, kind, squares: Number(doc.width) || 1, id: doc.id ?? token.id, x: token.x ?? 0, y: token.y ?? 0, w: token.w ?? 0, h: token.h ?? 0 });
      } catch { /* a token mid-teardown: skip it */ }
    }
    for (const p of pickIdle(placed, this.view(), this.cap)) want.set(PREFIX + p.id, p);
    return want;
  }
  sync() {
    const want = this.wanted();
    for (const name of [...this.shown.keys()]) if (!want.has(name)) { this.shown.delete(name); this.body.remove(name, { immediate: true }); }
    // How strongly they idle (this screen's Idle life strength).
    const strength = Math.min(2, Math.max(0.25, Number(this.strength()) || 1));
    for (const [name, p] of want) {
      const was = this.shown.get(name);
      if (was && was.kind === p.kind && was.token === p.token && was.strength === strength) continue;
      const period = p.kind === 'idle-breathe' ? breathPeriod(p.id, p.squares) : HOVER_PERIOD;
      this.body.add(name, p.token, p.kind, { phase: idlePhase(p.id) * period, period, strength });
      this.shown.set(name, { kind: p.kind, token: p.token, strength });
    }
  }
  clear() {
    for (const name of [...this.shown.keys()]) this.body.remove(name, { immediate: true });
    this.shown.clear();
  }
}
