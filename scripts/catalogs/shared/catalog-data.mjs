// Foundry's first game global is only {view}; the native system script tags
// already identify its package before Game is constructed. Ambiguous/missing
// metadata falls back to loading everything (including headless catalog tools).
export function catalogSystem({game = globalThis.game, document = globalThis.document} = {}) {
  if (game?.system?.id) return game.system.id;
  const systems = new Set();
  for (const node of document?.querySelectorAll?.('script[src], link[href]') ?? []) {
    const source = node.getAttribute('src') ?? node.getAttribute('href') ?? '';
    const id = /(?:^|\/)systems\/([^/]+)\//.exec(source)?.[1];
    if (id) systems.add(id);
  }
  return systems.size === 1 ? systems.values().next().value : undefined;
}
// Both 2e catalogs stay available for crossover changes during a session.
export function catalogDataNeeded(system, active = catalogSystem()) {
  if (!active) return true;
  return system === active || (['pf2e', 'sf2e'].includes(system) && ['pf2e', 'sf2e'].includes(active));
}
