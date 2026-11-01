// Tokenshade runtime (animater's token shader engine). Effects are local to this client: nothing is written to
// documents, nothing is synced through sockets; sync* animations share the world clock.
import { fxFilterClass } from './filter-factory.mjs';
import { specFor } from './filters/index.mjs';

// Build the filters for a preset (sorted by stacking order). Unknown filter types are
// skipped so a user's preset with an exotic filter still shows the rest.
export function presetFilters(PIXI, preset, { tokenSize = null, key = '', textures = null } = {}) {
  const FxFilter = fxFilterClass(PIXI);
  const filters = [];
  for (const [i, params] of (preset?.params ?? []).entries()) {
    if (!params || !specFor(params.filterType) || params.enabled === false) continue;
    try { filters.push(new FxFilter(params, { tokenSize, key: `${key}:${preset.name}:${i}`, textures })); }
    catch (error) { console.warn(`Animater FX: ${params.filterType} skipped:`, error.message); }
  }
  return filters.sort((a, b) => a.zOrder - b.zOrder);
}

const tokenSize = token => {
  const w = Number(token?.w ?? token?.width), h = Number(token?.h ?? token?.height);
  return w > 0 && h > 0 ? { width: w, height: h } : null;
};

// Live values eased toward their target over about this long, so a hit or a take-off shades in, never snaps.
const DRIVE_EASE_MS = 400;
// How strongly an effect shows while it fades in (from `start`) and out (from `leavingAt`) over `fadeMs`, 0..1.
export function blendMix({ start = 0, leavingAt = 0, fadeMs = 0 } = {}, time) {
  if (!(fadeMs > 0)) return leavingAt ? 0 : 1;
  const fadeIn = Math.min(1, Math.max(0, (time - start) / fadeMs));
  const fadeOut = leavingAt ? Math.min(1, Math.max(0, 1 - (time - leavingAt) / fadeMs)) : 1;
  return fadeIn * fadeOut;
}
export class TokenFxEngine {
  // `drive(token, sources)`: the creature's live values (animation.mjs DRIVE_SOURCES), 0..1, for effects that follow
  // the game; main.mjs supplies it. `blendMs()`: how long an effect fades in and out, so a look that changes
  // crossfades (0: at once).
  constructor({ PIXI = null, ticker = () => globalThis.canvas?.app?.ticker,
    now = () => performance.now(), world = () => globalThis.game?.time?.serverTime ?? Date.now(), enabled = () => true, drive = () => ({}), blendMs = () => 0 } = {}) {
    Object.assign(this, { PIXI, ticker, now, world, enabled, drive, blendMs });
    this.entries = new Set();
    this.listening = null;
  }
  // Show `preset` on `token` until the returned function is called. `always`: a state
  // look (a creature turned to stone) that stays even while decorative effects are off.
  // `blend: false`: no fade in or out (a teleport's dissolve, which must not show the plain art first).
  apply(token, preset, { key = '', always = false, speed = 1, blend = true } = {}) {
    if (!token || token.destroyed) return () => {};
    const filters = presetFilters(this.PIXI ?? globalThis.PIXI, preset, { tokenSize: tokenSize(token), key });
    if (!filters.length) return () => {};
    const sources = [...new Set(filters.flatMap(f => f.animations?.sources ?? []))];
    let fadeMs = 0;
    try { fadeMs = blend === false ? 0 : Math.max(0, Number(this.blendMs()) || 0); } catch { /* at once */ }
    const entry = { token, filters, start: this.now(), mesh: null, always, speed: Number.isFinite(+speed) && +speed > 0 ? +speed : 1, sources, live: null, liveAt: 0, fadeMs, leavingAt: 0 };
    this.entries.add(entry);
    this.advance(entry, this.now(), this.world());
    this.attach(entry);
    this.listen();
    return () => this.remove(entry);
  }
  // Ends an effect: it fades out over its blend time first (a look replaced by another crossfades into it).
  remove(entry) {
    if (!this.entries.has(entry) || entry.leavingAt) return;
    if (!(entry.fadeMs > 0) || !entry.mesh || entry.token?.destroyed) { this.drop(entry); return; }
    entry.leavingAt = this.now();
  }
  drop(entry) {
    if (!this.entries.delete(entry)) return;
    this.detach(entry);
    for (const f of entry.filters) { try { f.destroy(); } catch { /* already gone with the canvas */ } }
    if (!this.entries.size) this.unlisten();
  }
  clear() { for (const entry of [...this.entries]) this.drop(entry); }
  has(token) { return [...this.entries].some(e => e.token === token); }
  // Does a shown look move the token's art (a transform: rocking, swaying, trembling)?
  moves(token) { return [...this.entries].some(e => e.token === token && e.filters.some(f => f.spec?.type === 'transform' && f.enabled !== false)); }

  // Our filters sit after any other module's on the token mesh, in our stacking order.
  attach(entry) {
    const mesh = entry.token.mesh;
    if (!mesh || mesh.destroyed) return;
    entry.mesh = mesh;
    const ours = new Set(entry.filters);
    const others = (mesh.filters ?? []).filter(f => !ours.has(f));
    mesh.filters = [...others, ...entry.filters];
  }
  detach(entry) {
    const mesh = entry.mesh;
    entry.mesh = null;
    if (!mesh || mesh.destroyed || !mesh.filters) return;
    const ours = new Set(entry.filters);
    const rest = mesh.filters.filter(f => !ours.has(f));
    mesh.filters = rest.length ? rest : null;
  }
  advance(entry, time, world) {
    // Speed scales both clocks, so clients at the same speed stay in phase.
    const local = (time - entry.start) * entry.speed;
    const live = entry.sources.length ? this.liveValues(entry, time) : null;
    const mix = blendMix(entry, time);
    for (const f of entry.filters) { f.fxBlend = mix; f.update(local, world * entry.speed, live); }
  }
  // The creature's live values, eased toward what the game says now (first read: straight to it).
  liveValues(entry, time) {
    let target = {};
    try { target = this.drive(entry.token, entry.sources) ?? {}; } catch { /* keep the last values */ }
    const k = entry.live ? Math.min(1, Math.max(0, (time - entry.liveAt) / DRIVE_EASE_MS)) : 1;
    entry.live ??= {};
    for (const s of entry.sources) {
      const goal = Math.min(1, Math.max(0, Number(target[s]) || 0));
      entry.live[s] = (entry.live[s] ?? goal) + (goal - (entry.live[s] ?? goal)) * k;
    }
    entry.liveAt = time;
    return entry.live;
  }
  tick() {
    if (!this.entries.size) return;
    const time = this.now(), world = this.world(), on = this.enabled();
    for (const entry of [...this.entries]) {
      const token = entry.token;
      if (!token || token.destroyed) { this.drop(entry); continue; }
      if (entry.leavingAt && time - entry.leavingAt >= entry.fadeMs) { this.drop(entry); continue; }
      // A redraw gives the token a new mesh: follow it.
      if (token.mesh !== entry.mesh) { this.detach(entry); this.attach(entry); }
      const mesh = entry.mesh;
      if (!mesh) continue;
      const visible = (on || entry.always) && token.visible !== false && mesh.visible !== false && mesh.renderable !== false && mesh.worldAlpha > 0;
      for (const f of entry.filters) f.enabled = visible;
      if (!visible) continue;
      this.advance(entry, time, world);
      for (const f of entry.filters) f.measure(mesh);
    }
  }
  listen() {
    const ticker = this.ticker();
    if (!ticker || this.listening === ticker) return;
    this.unlisten();
    // Before Foundry renders the frame, after token refreshes have moved meshes.
    ticker.add(this.tick, this, ((this.PIXI ?? globalThis.PIXI)?.UPDATE_PRIORITY?.LOW ?? -25) + 1);
    this.listening = ticker;
  }
  unlisten() {
    try { this.listening?.remove(this.tick, this); } catch { /* ticker destroyed */ }
    this.listening = null;
  }
}
