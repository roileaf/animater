// Share primitive setting reads across hot callers. Foundry finds a world setting's value by scanning every stored
// setting document (thousands in a world with many modules: a tenth of a millisecond a read), so the per-frame
// effects read each setting once and keep it until it changes: main.mjs invalidates on Foundry's setting hooks and
// each setting's onChange, and every value is read afresh after `ttl` ms anyway, so a change that slips past the
// hooks (another module writing storage directly) is picked up within a moment.
export function frameSettings({ get, now = () => globalThis.performance?.now?.() ?? Date.now(), ttl = 2000 }) {
  const values = new Map();
  const primitive = (value) => value === null || ['boolean', 'number', 'string', 'undefined'].includes(typeof value);
  return {
    get(key) {
      const time = now(), had = values.get(key);
      if (had && time - had.at < ttl) return had.value;
      const value = get(key);
      if (primitive(value)) values.set(key, { value, at: time }); else values.delete(key);
      return value;
    },
    invalidate() { values.clear(); },
    // Foundry can invoke onChange before updating its own read cache. The callback's validated value is
    // authoritative until the next invalidation.
    changed(key, value) {
      values.clear();
      if (primitive(value)) values.set(key, { value, at: now() });
    },
  };
}
