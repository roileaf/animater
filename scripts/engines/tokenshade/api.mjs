// Tokenshade for animater: the built-in shader engine plus, when Token Magic FX
// is active, the world's own Token Magic presets under names animater does not already use.
// Rendering is always animater's: Token Magic is only read as a source of preset data.
import { PRESETS, LIBRARY, libraryId } from './presets.mjs';
import { TokenFxEngine } from './engine.mjs';

const byLibrary = new Map();
const builtins = library => {
  if (!byLibrary.has(library)) byLibrary.set(library, PRESETS.filter(p => p.library === library));
  return byLibrary.get(library);
};

export const CUSTOM_LIBRARY = LIBRARY.CUSTOM;
// Where Token Magic keeps the world presets that correspond to each Tokenshade library.
const TOKEN_MAGIC_LIBRARY = { [LIBRARY.TOKEN]: 'tmfx-main', [LIBRARY.REGION]: 'tmfx-region' };
export function tokenFxApi({ engine = new TokenFxEngine(), tokenMagic = () => globalThis.TokenMagic, modules = () => globalThis.game?.modules, custom = () => [] } = {}) {
  const api = {
    engine,
    // The world's saved presets (set by main.mjs from a world setting).
    custom,
    // Only where there is a renderer to draw with (never in node, or before PIXI loads).
    ready: () => typeof (engine.PIXI ?? globalThis.PIXI)?.Filter === 'function',
    // Shared preset objects: clone before changing them.
    getPresets(library = LIBRARY.TOKEN) {
      library = libraryId(library);
      if (library === CUSTOM_LIBRARY) { try { return (api.custom() ?? []).filter(p => p?.name && Array.isArray(p.params)).map(p => ({ ...p, library })); } catch { return []; } }
      const own = builtins(library);
      const tm = tokenMagic();
      if (!TOKEN_MAGIC_LIBRARY[library] || !modules()?.get?.('tokenmagic')?.active || typeof tm?.getPresets !== 'function') return own;
      const names = new Set(own.map(p => p.name));
      // Presets other modules ship into Token Magic (Baileywiki's '[BW] …' set) are theirs, not
      // the world's own work: Tokenshade has its own takes on those looks.
      const foreign = name => /^\[?BW\]?\s/i.test(name);
      let world = [];
      try { world = (tm.getPresets(TOKEN_MAGIC_LIBRARY[library]) ?? []).filter(p => p?.name && Array.isArray(p.params) && !names.has(p.name) && !foreign(p.name)).map(p => ({ ...p, library })); }
      catch { /* Token Magic's settings unavailable: animater's own presets still play. */ }
      return world.length ? [...own, ...world] : own;
    },
    // Show a preset on a token placeable; returns the function that removes it.
    apply(token, preset, options) { return engine.apply(token, preset, options); },
    clear() { engine.clear(); },
  };
  return api;
}

// The one this client uses (main.mjs ties its on/off switch to the quality setting).
export const tokenFx = tokenFxApi();
