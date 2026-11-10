// Tokenshade looks applied to a token from the Tokenshade studio (Apply to selected tokens): kept in the token's
// flags (flags.animater.appliedLooks), so every screen draws them, and they stay until removed. Each client keeps
// the filters it draws in step with the flags (sync), through a retain(stage) that returns a stop function.

export const APPLIED_FLAG = 'appliedLooks';
const MAX = 8;

// The flag's list, cleaned: [{ id, name, stage }] with a token filter stage each, at most MAX.
export function normalizeApplied(list) {
  const out = [];
  for (const look of Array.isArray(list) ? list : []) {
    const stage = look?.stage;
    if (!look?.id || !stage || stage.kind !== 'tokenfx' || !(stage.fxPreset || stage.fxLayers?.length)) continue;
    if (out.some((l) => l.id === look.id)) continue;
    out.push({ id: String(look.id), name: String(look.name ?? stage.fxPreset ?? 'Look').slice(0, 80), stage: structuredClone(stage) });
  }
  return out.slice(-MAX);
}
// The list with `look` added; the same look (same preset and layers) again replaces the older one.
export function withApplied(list, { name, stage }, id = `look-${Date.now().toString(36)}`) {
  const sig = signature(stage), kept = normalizeApplied(list).filter((l) => signature(l.stage) !== sig);
  return normalizeApplied([...kept, { id, name, stage }]);
}
export const signature = (stage) => JSON.stringify([stage?.fxLibrary ?? '', stage?.fxPreset ?? '', stage?.fxLayers ?? null, stage?.fxSpeed ?? 1, stage?.fxTint ?? '', stage?.fxStrength ?? 1]);

// One client's drawn looks: token id → Map(look id → { sig, stop }).
export class AppliedLooks {
  // retain(stage): Promise of a stop function, or undefined when this screen draws no filters (quality).
  constructor({ retain, trace = () => {} } = {}) { Object.assign(this, { retain, trace }); this.shown = new Map(); this.queue = new Map(); }
  // Draws what the token's flags ask for and stops what they no longer do. One token's syncs run one after
  // another (a look still being drawn when the flag goes is then stopped by the next).
  sync(doc) {
    const id = doc?.id; if (!id) return Promise.resolve();
    const run = (this.queue.get(id) ?? Promise.resolve()).then(() => this.#sync(doc), () => this.#sync(doc));
    this.queue.set(id, run);
    void run.finally(() => { if (this.queue.get(id) === run) this.queue.delete(id); });
    return run;
  }
  async #sync(doc) {
    const id = doc.id;
    const want = new Map(normalizeApplied(doc.flags?.animater?.[APPLIED_FLAG]).map((l) => [l.id, l]));
    const have = this.shown.get(id) ?? new Map();
    for (const [lookId, s] of [...have]) if (!want.has(lookId) || signature(want.get(lookId).stage) !== s.sig) { have.delete(lookId); await this.#stop(s); }
    for (const [lookId, look] of want) {
      if (have.has(lookId)) continue;
      const entry = { sig: signature(look.stage), stop: null, gone: false };
      have.set(lookId, entry);
      try {
        const stop = await this.retain({ ...look.stage, kind: 'tokenfx', destination: doc });
        if (entry.gone) await stop?.(); else entry.stop = stop ?? null;
      } catch (error) { this.trace(`Applied look ${look.name}: ${error.message}`); }
    }
    if (have.size) this.shown.set(id, have); else this.shown.delete(id);
  }
  drop(id) {
    const run = (this.queue.get(id) ?? Promise.resolve()).catch(() => {}).then(async () => { const have = this.shown.get(id); this.shown.delete(id); for (const s of have?.values() ?? []) await this.#stop(s); });
    this.queue.set(id, run);
    return run;
  }
  async clear() { for (const id of [...this.shown.keys()]) await this.drop(id); }
  async #stop(s) { s.gone = true; try { await s.stop?.(); } catch { /* the token is gone */ } }
}
