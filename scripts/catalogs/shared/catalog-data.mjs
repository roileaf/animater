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

// Catalog data (tens of MB for PF2e) is not part of a player's first load: in the browser each catalog
// file loads when it is asked for (loadCatalogData: once the canvas is up, a catalog that is on; the
// Animater window, all of them), filling its module's lists in place. Headless (node tools and tests,
// no document) it loads as the module is imported, for every system catalogDataNeeded allows.
const sources = [];
const listeners = new Set();
export const catalogDataEager = ({ document = globalThis.document } = {}) => !document;
const run = (source) => source.promise ??= Promise.resolve().then(source.load).then(() => {
  source.loaded = true;
  for (const listener of listeners) try { listener(source.system, source.name); } catch (error) { console.warn('Animater | catalog data listener failed', error); }
}, (error) => { source.promise = null; throw error; });
// A module's data file: `load` imports it and fills the module's lists. Returns the load to await
// headless, or null in the browser (nothing loads until asked).
export function catalogData(system, name, load) {
  const source = { system, name, load, promise: null, loaded: false };
  sources.push(source);
  return catalogDataEager() && catalogDataNeeded(system) ? run(source) : null;
}
// Loads the data files of these systems (and only these names, given), one after another so no single
// frame parses them all; resolves when all are in.
export async function loadCatalogData({ systems, names } = {}) {
  const wanted = sources.filter((s) => (!systems || systems.includes(s.system)) && (!names || names.includes(s.name)));
  for (const source of wanted) await run(source);
}
export const catalogDataLoaded = (system, name) => sources.some((s) => s.system === system && (!name || s.name === name) && s.loaded);
export const catalogDataNames = (system) => sources.filter((s) => s.system === system).map((s) => s.name);
// Called with (system, name) each time a data file has loaded.
export function onCatalogData(listener) { listeners.add(listener); return () => listeners.delete(listener); }
// Fills a module's exported list in place (importers hold the same array).
export function fillList(target, rows) { for (const row of rows ?? []) target.push(row); return target; }
