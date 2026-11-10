// The lights decorations carry: a lamp post's lantern, a brazier's fire, a cluster of candles. Each is a real Foundry light
// source on this client (it lights the map, shows what is round it in the dark, and other things throw shadows from it), built
// the same on every screen from the region's own decorations, never a document. Foundry is reached only through makeSource.

/**
 * makeSource(id) → { initialize(data), add(), destroy() }; refresh() redraws the lighting once after changes; grid() pixels per
 * square; max how many at most (the nearest the view's middle win, so a town full of lamps stays light on the GPU).
 * sync(list): [{ id, x, y, dim, bright (squares), color, animation }] as decorations.lights() gives them.
 */
export function createDecorLights({ makeSource, refresh = () => {}, grid = () => 100, max = 48, centre = () => null }) {
  const live = new Map(); // id → { key, source }
  const keyOf = (l, g) => JSON.stringify([Math.round(l.x), Math.round(l.y), +(l.dim * g).toFixed(1), +(l.bright * g).toFixed(1), l.color ?? null, l.animation?.type ?? null]);
  const drop = (id) => { const had = live.get(id); live.delete(id); try { had?.source.destroy(); } catch { /* gone with the canvas */ } };
  return {
    sync(list = []) {
      const g = grid(), at = centre();
      let wanted = list.filter((l) => Number.isFinite(l.x) && Number.isFinite(l.y) && l.dim > 0);
      if (wanted.length > max) wanted = at ? [...wanted].sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y)).slice(0, max) : wanted.slice(0, max);
      const keep = new Set(wanted.map((l) => l.id));
      let changed = false;
      for (const id of [...live.keys()]) if (!keep.has(id)) { drop(id); changed = true; }
      for (const l of wanted) {
        const key = keyOf(l, g), had = live.get(l.id);
        if (had?.key === key) continue;
        if (had) drop(l.id);
        try {
          const source = makeSource(l.id);
          source.initialize({ x: l.x, y: l.y, dim: l.dim * g, bright: l.bright * g, color: l.color ?? null, alpha: 0.5, luminosity: 0.5, coloration: 1, attenuation: 0.5, vision: false, walls: true, priority: 0, animation: l.animation ?? {} });
          source.add();
          live.set(l.id, { key, source });
          changed = true;
        } catch (err) { console.warn('Animater | a decoration light could not be placed', err); }
      }
      if (changed) { try { refresh(); } catch { /* canvas going away */ } }
      return live.size;
    },
    clear() { for (const id of [...live.keys()]) drop(id); },
    get count() { return live.size; },
  };
}
