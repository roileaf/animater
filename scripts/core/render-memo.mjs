// Host reads that cannot change while one synchronous render runs. A single
// render asks for the sound catalog (a walk of the Sequencer database) and the
// saved recipes (a deep clone of the setting) many times over. Outside a render
// every call reaches the host again, so a sound pack registered later or a
// newly saved recipe is never hidden.
const MEMOIZED = new Set(["soundCatalog", "recipes"]);
const CACHE = Symbol("animater.renderMemo");

export function withRenderMemo(owner, fn) {
  const host = owner.host;
  if (!host || host[CACHE]) return fn();
  let cache = new Map();
  const reads = new Map();
  const proxy = new Proxy(host, {
    get(target, prop) {
      if (prop === CACHE) return cache;
      const value = Reflect.get(target, prop);
      if (!MEMOIZED.has(prop) || typeof value !== "function") return value;
      if (!reads.has(prop))
        reads.set(prop, (...args) => {
          if (!cache || args.length) return value.apply(target, args);
          if (!cache.has(prop)) cache.set(prop, value.call(target));
          return cache.get(prop);
        });
      return reads.get(prop);
    },
  });
  owner.host = proxy;
  try {
    return fn();
  } finally {
    cache = null;
    if (owner.host === proxy) owner.host = host;
  }
}

// A value derived from host state, computed once per render. Outside a render
// it is computed fresh, or by `outside` when a one-off read has a cheaper way.
export function renderMemo(host, key, compute, outside = compute) {
  const cache = host?.[CACHE];
  if (!cache) return outside();
  const id = `memo:${key}`;
  if (!cache.has(id)) cache.set(id, compute());
  return cache.get(id);
}
