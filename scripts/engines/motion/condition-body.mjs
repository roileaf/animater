// Condition body treatments: the creature itself reacts while a lasting condition
// is active (trembling in fear, swaying with nausea, turned to grey stone…).
// Applied locally to the token's sprite every frame and fully restored on removal;
// the token document never moves. One-off token motions (attacks, recoils) take
// priority: the treatment steps aside while they play.

import { nextFrame, cancelFrame } from './canvas-frame.mjs';

// Condition names (D&D 5e, PF2e, SF2e) → treatment.
const BY_NAME = {
  frightened: 'tremble', fleeing: 'tremble', glitching: 'tremble',
  poisoned: 'sway', diseased: 'sway', sickened: 'sway', charmed: 'sway', fascinated: 'sway', controlled: 'sway', untethered: 'sway',
  stunned: 'wobble', incapacitated: 'wobble', confused: 'wobble', stupefied: 'wobble',
  exhaustion: 'sag', fatigued: 'sag', encumbered: 'sag', 'heavily encumbered': 'sag', 'exceeding carrying capacity': 'sag', drained: 'sag', enfeebled: 'sag', slowed: 'sag', dehydration: 'sag', malnutrition: 'sag',
  grappled: 'struggle', grabbed: 'struggle', restrained: 'struggle', immobilized: 'struggle',
  blinded: 'search',
  // Daggerheart: Vulnerable is off balance.
  vulnerable: 'wobble',
  unconscious: 'breathe', sleeping: 'breathe', dying: 'breathe', stable: 'breathe',
  petrified: 'stone', prone: 'prone',
  paralyzed: 'still', dead: 'still',
};
// With several conditions, the token shows the most telling one: a body turned to
// stone or held still does not move at all, a body knocked down lies on its side, a body on the ground only breathes, and
// a grapple outweighs fear, sickness or weariness. Equal ranks: the latest applied.
export const BODY_PRIORITY = ['stone', 'still', 'prone', 'breathe', 'struggle', 'wobble', 'tremble', 'sway', 'search', 'sag'];
const rank = (kind) => { const i = BODY_PRIORITY.indexOf(kind); return i < 0 ? BODY_PRIORITY.length : i; };
// The treatment a token shows for its active treatments (null: none, or no motion).
export function shownTreatment(kinds) {
  let best = null;
  for (const kind of kinds) if (best === null || rank(kind) <= rank(best)) best = kind;
  return best && !['stone', 'still'].includes(best) ? best : null;
}
export function bodyTreatment(name = '') {
  const key = String(name).toLowerCase().replace(/^(?:condition|effect)\s*:\s*/, '').replace(/\s+\d+$/, '').trim();
  return BY_NAME[key] ?? null;
}
const RISE = 400;
const TAU = Math.PI * 2, wave = (t, period) => Math.sin((TAU * t) / period);
// Pose deltas: x/y in token widths, rotation in degrees, sy as a scale factor.
export function bodyPose(kind, t, strength = 1) {
  const k = strength;
  switch (kind) {
    case 'tremble': return { x: 0.012 * k * wave(t, 0.11), y: 0.006 * k * wave(t, 0.17), r: 0.8 * k * wave(t, 0.13) };
    case 'sway': return { x: 0.02 * k * wave(t, 2.6), r: 4 * k * wave(t, 2.6) };
    case 'wobble': return { y: 0.012 * k * wave(t, 0.7), r: 6 * k * wave(t, 1.4) };
    case 'sag': { const s = 0.5 + 0.5 * wave(t, 3.6); return { y: 0.02 * k * s, sy: 1 - 0.04 * k * s }; }
    case 'struggle': { const burst = wave(t, 1.7) > 0.3 ? 1 : 0.2; return { x: 0.008 * k * burst * wave(t, 0.23), r: 3 * k * burst * wave(t, 0.33) }; }
    case 'search': return { r: 9 * k * wave(t, 3.2) };
    case 'breathe': return { sy: 1 - 0.025 * k * (0.5 + 0.5 * wave(t, 4)) };
    // Knocked down: the token lies on its side, a little lower, still breathing.
    case 'prone': { const f = Math.min(1, t / 0.4), fall = 1 - (1 - f) ** 3; return { r: 80 * fall, y: 0.06 * fall, sy: 1 - 0.02 * (0.5 + 0.5 * wave(t, 4)) }; }
    default: return {};
  }
}


export class ConditionBody {
  constructor({ tokenFx = () => null, now = () => performance.now(), frame = nextFrame, cancel = cancelFrame, busy = () => false, enabled = () => true } = {}) {
    Object.assign(this, { tokenFx, now, frame, cancel, busy, enabled });
    this.records = new Map();
    // One pose per token: several conditions (PF2e Dying brings Unconscious) must not
    // each treat the other's offset as the natural pose, or the deltas compound
    // every frame until the sprite collapses to nothing.
    this.poses = new Map();
    this.handle = null;
  }
  add(name, token, kind, { strength = 1 } = {}) {
    if (!kind || !token?.mesh) return;
    this.remove(name, { immediate: true });
    const record = { token, kind, strength, start: this.now() };
    if (kind === 'stone') {
      // Turned to stone: drain the colour, no overlay at all, with animater's own
      // adjustment filter (this screen only, nothing saved). Without the FX engine
      // the sprite is tinted stone grey.
      const api = this.tokenFx?.();
      if (api?.apply) {
        try { record.stone = api.apply(token, { name: `animater-stone-${name}`, library: 'animater', params: [{ filterType: 'adjustment', saturation: 0.08, brightness: 0.95, contrast: 1.1 }] }, { always: true }); }
        catch { record.stone = null; }
      }
      if (!record.stone) {
        record.tint = token.mesh.tint;
        token.mesh.tint = 0xa39e94;
      }
    }
    this.records.set(name, record);
    if (!this.handle) this.handle = this.frame(() => this.tick());
  }
  // A token lying down stands back up over RISE ms (the end of a preview, or the condition
  // removed) instead of snapping upright; everything else ends at once.
  remove(name, { immediate = false } = {}) {
    const r = this.records.get(name);
    if (!r) return;
    if (!immediate && r.kind === 'prone' && this.enabled()) {
      r.leaving ??= this.now();
      if (!this.handle) this.handle = this.frame(() => this.tick());
      return;
    }
    this.records.delete(name);
    if (![...this.records.values()].some(o => o.token === r.token)) this.restore(r.token);
    if (r.stone) { try { r.stone(); } catch { /* the canvas already went away */ } }
    if (r.tint !== undefined && r.token.mesh && !r.token.mesh.destroyed) r.token.mesh.tint = r.tint;
    if (!this.records.size && this.handle) { this.cancel(this.handle); this.handle = null; }
  }
  clear() { for (const name of [...this.records.keys()]) this.remove(name, { immediate: true }); }
  // Is a treatment moving this token's sprite right now (stone and stillness hold it still)?
  moves(token) { return shownTreatment([...this.records.values()].filter(r => r.token === token).map(r => r.kind)) !== null; }
  // Undo only what this treatment set; if the token refreshed in between, its
  // pose is already natural and there is nothing to undo.
  restore(token) {
    const mesh = token?.mesh, a = this.poses.get(token);
    this.poses.delete(token);
    if (!a || !mesh || mesh.destroyed) return;
    if (mesh.position.x === a.setX) mesh.position.x = a.baseX;
    if (mesh.position.y === a.setY) mesh.position.y = a.baseY;
    if (mesh.rotation === a.setR) mesh.rotation = a.baseR;
    if (mesh.scale.y === a.setSY) mesh.scale.y = a.baseSY;
  }
  tick() {
    this.handle = null;
    if (!this.records.size) return;
    const time = this.now(), on = this.enabled();
    for (const [name, r] of [...this.records]) if (r.leaving !== undefined && time - r.leaving >= RISE) this.remove(name, { immediate: true });
    if (!this.records.size) return;
    // Each token shows its highest-priority treatment (see BODY_PRIORITY); stone or
    // stillness anywhere on the token holds it in its natural pose.
    const byToken = new Map();
    for (const r of this.records.values()) byToken.set(r.token, [...(byToken.get(r.token) ?? []), r]);
    const shown = new Map();
    for (const [token, list] of byToken) {
      const kind = shownTreatment(list.map((r) => r.kind));
      if (kind) shown.set(token, list.findLast((r) => r.kind === kind));
    }
    for (const token of new Set([...this.records.values()].map(r => r.token))) if (!shown.has(token)) this.restore(token);
    for (const [token, r] of shown) {
      const mesh = token?.mesh;
      if (!mesh || mesh.destroyed || token.destroyed) continue;
      if (!on || this.busy(token)) { this.restore(token); continue; }
      const a = this.poses.get(token);
      // Natural pose: what Foundry last set, minus our own delta if still in place.
      const baseX = a && mesh.position.x === a.setX ? a.baseX : mesh.position.x;
      const baseY = a && mesh.position.y === a.setY ? a.baseY : mesh.position.y;
      const baseR = a && mesh.rotation === a.setR ? a.baseR : mesh.rotation;
      const baseSY = a && mesh.scale.y === a.setSY ? a.baseSY : mesh.scale.y;
      const full = bodyPose(r.kind, (time - r.start) / 1000, r.strength), w = token.w ?? 100;
      // Standing back up: the pose eases away.
      const f = r.leaving === undefined ? 1 : (1 - Math.min(1, (time - r.leaving) / RISE)) ** 2;
      const pose = { x: (full.x ?? 0) * f, y: (full.y ?? 0) * f, r: (full.r ?? 0) * f, sy: 1 - (1 - (full.sy ?? 1)) * f };
      mesh.position.x = baseX + (pose.x ?? 0) * w;
      mesh.position.y = baseY + (pose.y ?? 0) * w;
      mesh.rotation = baseR + ((pose.r ?? 0) * Math.PI) / 180;
      mesh.scale.y = baseSY * (pose.sy ?? 1);
      this.poses.set(token, { baseX, baseY, baseR, baseSY, setX: mesh.position.x, setY: mesh.position.y, setR: mesh.rotation, setSY: mesh.scale.y });
    }
    if (this.records.size) this.handle = this.frame(() => this.tick());
  }
}
