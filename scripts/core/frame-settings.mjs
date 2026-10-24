// Share primitive reads across hot callers for one rendered frame. Mutable
// settings keep Foundry's normal getter semantics; the next frame always reads
// afresh, even if another module changes a setting without an invalidation hook.
export function frameSettings({get, frame}) {
  const values = new Map();
  let stamp;
  return {
    get(key) {
      const next = frame();
      if (next !== stamp) { values.clear(); stamp = next; }
      if (values.has(key)) return values.get(key);
      const value = get(key);
      if (value === null || ['boolean', 'number', 'string', 'undefined'].includes(typeof value)) values.set(key, value);
      return value;
    },
    invalidate() { values.clear(); },
    // Foundry can invoke onChange before updating its own read cache. The
    // callback's validated value is authoritative for the remainder of this frame.
    changed(key, value) {
      values.clear(); stamp = frame();
      if (value === null || ['boolean', 'number', 'string', 'undefined'].includes(typeof value)) values.set(key, value);
    },
  };
}
