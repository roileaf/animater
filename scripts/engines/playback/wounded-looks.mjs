// Wounded looks: a creature shows how hurt it is. At half its HP or less it wears a toned-down
// Tokenshade 'Wounded' look; at a quarter or less a stronger one, standing with a slight hunch
// and limping while it moves (ConditionBody's `hunch` and `limp` kinds). Healing back above a
// line (with a small margin, so a hit point either way does not flicker) removes the look; a
// creature that is down or defeated shows the defeated look instead. Local only: every client
// decides from the same HP, nothing is saved. Every Foundry call is injected.

export const HURT = 0.5;
export const BADLY = 0.25;
// Healing must clear a line by this much before its look goes.
export const MARGIN = 0.03;
const PREFIX = 'animater-wound:';
const POLL_MS = 120;
// Actor types that are not creatures (PF2e/SF2e hazards, loot, parties; D&D vehicles, groups,
// encounters; Daggerheart environments).
const NOT_CREATURES = new Set(['hazard', 'loot', 'party', 'army', 'group', 'encounter', 'environment', 'vehicle']);

// Share of HP left (0..1) from an hp-state.mjs state, or null when unreadable. A marked track
// (Daggerheart) counts what is still unmarked.
export function hpLeft(state) {
  if (!state || !(state.max > 0) || !Number.isFinite(state.value)) return null;
  return Math.max(0, Math.min(1, state.marked ? (state.max - state.value) / state.max : state.value / state.max));
}

// 0 none, 1 hurt, 2 badly hurt. `prev`: the tier shown now (for the healing margin).
export function woundTier(state, prev = 0) {
  const left = hpLeft(state);
  if (left === null || state.down) return 0;
  if (left <= BADLY || (prev >= 2 && left <= BADLY + MARGIN)) return 2;
  if (left <= HURT || (prev >= 1 && left <= HURT + MARGIN)) return 1;
  return 0;
}

// The look for a tier, made from the built-in 'Wounded' preset (cloned: the library is shared).
// Hurt: one small stain and colour barely lowered. Badly hurt: both stains, colour drained more.
export function woundedPreset(tier, base) {
  if (!base || !(tier >= 1)) return null;
  const p = structuredClone(base);
  p.name = `animater-wounded-${tier}`;
  p.library = 'animater';
  let splashes = 0;
  p.params = (p.params ?? []).flatMap((f) => {
    if (f.filterType === 'splash') {
      splashes += 1;
      if (tier === 1) return splashes === 1 ? [{ ...f, dimX: 0.75, dimY: 0.75 }] : [];
      return [{ ...f, drip: Math.max(f.drip ?? 0, 0.3) }];
    }
    if (f.filterType === 'adjustment') {
      const sat = f.saturation ?? 1, bright = f.brightness ?? 1;
      return tier === 1
        ? [{ ...f, saturation: 1 - (1 - sat) * 0.5, brightness: 1 - (1 - bright) * 0.5 }]
        : [{ ...f, saturation: 1 - (1 - sat) * 1.5, brightness: 1 - (1 - bright) * 1.3 }];
    }
    return [f];
  });
  return p;
}

// Does this actor's token get a look in this mode ('all', 'pcs' or 'off')? 'pcs': a character
// or any creature a player owns.
export function woundEligible(actor, mode) {
  if (!actor || mode === 'off' || NOT_CREATURES.has(String(actor.type ?? '').toLowerCase())) return false;
  if (mode === 'pcs') return actor.type === 'character' || actor.hasPlayerOwner === true;
  return true;
}

// Is the token on its way somewhere: an animation of Foundry's running on it, or its drawn
// position still short of where its document already is.
export function tokenMoving(token) {
  if (!token || token.destroyed) return false;
  if ((token.animationContexts?.size ?? 0) > 0) return true;
  const doc = token.document;
  if (!doc || !Number.isFinite(token.x) || !Number.isFinite(doc.x)) return false;
  return Math.abs(token.x - doc.x) > 1 || Math.abs((token.y ?? 0) - (doc.y ?? 0)) > 1;
}

// What to do to go from the looks shown to the looks wanted (both Map id → { token, tier, fx, kind }).
// Removals first, then additions; an unchanged look is left alone.
export function woundActions(shown, want) {
  const offs = [], ons = [];
  for (const [id, was] of shown) {
    const now = want.get(id);
    const fxGone = was.fx && (!now || !now.fx || now.tier !== was.tier || now.token !== was.token);
    const bodyGone = was.kind && (!now || now.kind !== was.kind || now.token !== was.token);
    if (fxGone) offs.push({ op: 'fx-off', id });
    if (bodyGone) offs.push({ op: 'body-off', id });
  }
  for (const [id, now] of want) {
    const was = shown.get(id);
    if (now.fx && (!was?.fx || was.tier !== now.tier || was.token !== now.token)) ons.push({ op: 'fx-on', id, tier: now.tier });
    if (now.kind && (was?.kind !== now.kind || was?.token !== now.token)) ons.push({ op: 'body-on', id, kind: now.kind });
  }
  return [...offs, ...ons];
}

export class WoundedLooks {
  // body: ConditionBody; fx(): the Tokenshade api; preset(): the base 'Wounded' preset;
  // tokens(): placeables; enabled(): the world and local settings allow it; mode(): 'all'|'pcs'|'off';
  // fxAllowed()/motionAllowed(): quality gates; hp(actor): hp-state; defeated(token); moving(token).
  constructor({ body, fx = () => null, preset = () => null, tokens = () => [], enabled = () => true, mode = () => 'all',
    fxAllowed = () => true, motionAllowed = () => true, hp = () => null, defeated = () => false, moving = () => false,
    schedule = (fn, ms) => setTimeout(fn, ms), cancel = (h) => clearTimeout(h), pollMs = POLL_MS } = {}) {
    Object.assign(this, { body, fx, preset, tokens, enabled, mode, fxAllowed, motionAllowed, hp, defeated, moving, schedule, cancel, pollMs });
    this.shown = new Map(); // token id → { token, tier, fx, kind, remove }
    this.tiers = new Map(); // token id → last tier (for the healing margin)
    this.timer = null;
  }
  kindFor(token, tier) {
    if (tier < 2 || !this.motionAllowed()) return null;
    let moving = false;
    try { moving = !!this.moving(token); } catch { /* treat as still */ }
    return moving ? 'limp' : 'hunch';
  }
  wanted() {
    const want = new Map();
    if (!this.enabled()) { this.tiers.clear(); return want; }
    const mode = this.mode(), fxOk = !!this.fxAllowed();
    const seen = new Set();
    for (const token of this.tokens() ?? []) {
      try {
        const id = token?.document?.id ?? token?.id;
        if (!token || token.destroyed || !token.visible || token.document?.hidden || !token.mesh) continue;
        if (!woundEligible(token.actor, mode) || this.defeated(token)) continue;
        const tier = woundTier(this.hp(token.actor), this.tiers.get(id) ?? 0);
        if (!tier) continue;
        seen.add(id);
        this.tiers.set(id, tier);
        const kind = this.kindFor(token, tier);
        if (fxOk || kind) want.set(id, { token, tier, fx: fxOk, kind });
      } catch { /* a token mid-teardown: skip it */ }
    }
    for (const id of [...this.tiers.keys()]) if (!seen.has(id)) this.tiers.delete(id);
    return want;
  }
  apply(actions, want) {
    for (const a of actions) {
      const name = PREFIX + a.id;
      try {
        if (a.op === 'fx-off') { const s = this.shown.get(a.id); try { s?.remove?.(); } catch { /* canvas gone */ } if (s) { s.fx = false; s.remove = null; } }
        else if (a.op === 'body-off') { this.body.remove(name, { immediate: true }); const s = this.shown.get(a.id); if (s) s.kind = null; }
        else {
          const w = want.get(a.id), s = this.shown.get(a.id) ?? { token: w.token, tier: w.tier, fx: false, kind: null, remove: null };
          Object.assign(s, { token: w.token, tier: w.tier });
          this.shown.set(a.id, s);
          if (a.op === 'fx-on') {
            const preset = woundedPreset(a.tier, this.preset()), api = this.fx();
            if (preset && api?.apply) { s.remove = api.apply(w.token, preset, { key: name }); s.fx = true; }
          } else if (a.op === 'body-on') { this.body.add(name, w.token, a.kind); s.kind = a.kind; }
        }
      } catch (error) { console.warn('Animater wounded looks:', error?.message ?? error); }
    }
    for (const [id, s] of [...this.shown]) if (!s.fx && !s.kind) this.shown.delete(id);
    // Keep tiers in step for looks whose fx could not be applied.
    for (const [id, w] of want) { const s = this.shown.get(id); if (s) s.tier = w.tier; }
  }
  sync() {
    const want = this.wanted();
    this.apply(woundActions(this.shown, want), want);
    if ([...this.shown.values()].some((s) => s.kind === 'limp')) this.watch();
  }
  // A token moved: check the badly hurt ones for a limp, and keep checking while they move.
  poke() { this.step(); }
  watch() { if (this.timer === null) this.timer = this.schedule(() => { this.timer = null; this.step(); }, this.pollMs); }
  step() {
    let anyMoving = false;
    for (const [id, s] of this.shown) {
      if (s.tier < 2 || !s.kind) continue;
      const kind = this.kindFor(s.token, s.tier);
      if (kind === 'limp') anyMoving = true;
      if (!kind || kind === s.kind) continue;
      try {
        this.body.remove(PREFIX + id, { immediate: true });
        this.body.add(PREFIX + id, s.token, kind);
        s.kind = kind;
      } catch (error) { console.warn('Animater wounded looks:', error?.message ?? error); }
    }
    if (anyMoving) this.watch();
  }
  clear() {
    if (this.timer !== null) { this.cancel(this.timer); this.timer = null; }
    for (const [id, s] of this.shown) {
      if (s.fx) { try { s.remove?.(); } catch { /* canvas gone */ } }
      if (s.kind) { try { this.body.remove(PREFIX + id, { immediate: true }); } catch { /* canvas gone */ } }
    }
    this.shown.clear();
    this.tiers.clear();
  }
}
