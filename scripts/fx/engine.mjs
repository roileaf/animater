// animater's token FX runtime. Effects are local to this client: nothing is written to
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

export class TokenFxEngine {
  constructor({ PIXI = null, ticker = () => globalThis.canvas?.app?.ticker,
    now = () => performance.now(), world = () => globalThis.game?.time?.serverTime ?? Date.now(), enabled = () => true } = {}) {
    Object.assign(this, { PIXI, ticker, now, world, enabled });
    this.entries = new Set();
    this.listening = null;
  }
  // Show `preset` on `token` until the returned function is called. `always`: a state
  // look (a creature turned to stone) that stays even while decorative effects are off.
  apply(token, preset, { key = '', always = false, speed = 1 } = {}) {
    if (!token || token.destroyed) return () => {};
    const filters = presetFilters(this.PIXI ?? globalThis.PIXI, preset, { tokenSize: tokenSize(token), key });
    if (!filters.length) return () => {};
    const entry = { token, filters, start: this.now(), mesh: null, always, speed: Number.isFinite(+speed) && +speed > 0 ? +speed : 1 };
    this.entries.add(entry);
    this.advance(entry, this.now(), this.world());
    this.attach(entry);
    this.listen();
    return () => this.remove(entry);
  }
  remove(entry) {
    if (!this.entries.delete(entry)) return;
    this.detach(entry);
    for (const f of entry.filters) { try { f.destroy(); } catch { /* already gone with the canvas */ } }
    if (!this.entries.size) this.unlisten();
  }
  clear() { for (const entry of [...this.entries]) this.remove(entry); }
  has(token) { return [...this.entries].some(e => e.token === token); }

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
    for (const f of entry.filters) f.update(local, world * entry.speed);
  }
  tick() {
    if (!this.entries.size) return;
    const time = this.now(), world = this.world(), on = this.enabled();
    for (const entry of [...this.entries]) {
      const token = entry.token;
      if (!token || token.destroyed) { this.remove(entry); continue; }
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
