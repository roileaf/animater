// Element reactions, the pure part: when a new ground mark lands on or near an older one, some pairs react (fire on
// frost puffs steam and melts it). Every client already holds the same mark records and seeds, so each one works
// the reaction out itself and nothing is sent. The layer, the drawing and the tokens are reached through options.

// New mark -> existing mark -> what happens. `removes` takes the existing mark off the floor.
export const REACTIONS = Object.freeze({
  scorch: Object.freeze({
    rime: Object.freeze({ kind: 'steam', removes: true, durationMs: 1200 }),
    stain: Object.freeze({ kind: 'flare', removes: false, durationMs: 600 }),
  }),
  rime: Object.freeze({ scorch: Object.freeze({ kind: 'smoke', removes: true, durationMs: 1000 }) }),
  streaks: Object.freeze({ residue: Object.freeze({ kind: 'arcs', removes: false, durationMs: 500 }) }),
  residue: Object.freeze({ rime: Object.freeze({ kind: 'bubbles', removes: false, durationMs: 900 }) }),
});

const MAX_REACTIONS = 6;
const OVERLAP = 0.8;

export function reactionFor(fresh, existing) {
  const hit = Object.hasOwn(REACTIONS, fresh) ? REACTIONS[fresh] : null;
  const r = hit && Object.hasOwn(hit, existing) ? hit[existing] : null;
  return r ? { ...r } : null;
}

/** A mark as one circle: a spot or a circle around its point, a line or cone around its middle, half its length out. */
export function markCircle(tag, gridPx = 100) {
  const { at } = tag;
  if (tag.shape === 'line' || tag.shape === 'cone') {
    const end = tag.endpoint, reach = Math.hypot(end.x - at.x, end.y - at.y);
    const length = tag.length > 0 ? tag.length : reach;
    const k = reach > 0 ? length / reach : 0;
    const ux = (end.x - at.x) * k, uy = (end.y - at.y) * k;
    return { x: at.x + ux / 2, y: at.y + uy / 2, r: length / 2 };
  }
  return { x: at.x, y: at.y, r: tag.radius > 0 ? tag.radius : gridPx / 2 };
}

export const overlaps = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * OVERLAP;

// One seed for the pair, so the puff looks the same on every screen.
export const reactionSeed = (fresh, existing) => ((fresh.seed >>> 0) ^ Math.imul((existing.seed >>> 0) + 1, 0x9e3779b1)) >>> 0;

const sameLevel = (a, b) => !a.level || !b.level || a.level === b.level;

/**
 * Reactions on this client. The mark layer calls `onLand(record)` as each mark lands. `near(point, radius)` lists the
 * marks on the floor overlapping a circle and `remove(record)` fades one out (the layer's); `spawn(reaction)` draws
 * one and returns `{ update(t) -> still running, destroy() }`; `tokensOn(point, radius)` the centres of the visible
 * tokens standing on a mark; `enabled()` whether this client draws reactions. At most `max` play at once; past
 * that the visuals are skipped but a reaction's removal still happens, so the floor matches on every screen.
 */
export function createReactionHost({ near, remove, spawn, enabled = () => true, now = () => performance.now(), gridSize = () => 100, tokensOn = () => [], max = MAX_REACTIONS }) {
  let active = [];
  const drop = (handle) => { try { handle.destroy(); } catch { /* already gone */ } };

  return {
    onLand(record) {
      const tag = record?.tag;
      if (!tag) return;
      try { if (!enabled()) return; } catch { return; }
      const grid = gridSize();
      const circle = markCircle(tag, grid);
      for (const other of near({ x: circle.x, y: circle.y }, circle.r) ?? []) {
        if (other === record || !other?.tag || !sameLevel(tag, other.tag)) continue;
        const found = reactionFor(tag.mark, other.tag.mark);
        if (!found) continue;
        const at = markCircle(other.tag, grid);
        if (active.length < max) {
          const reaction = { ...found, at: { x: at.x, y: at.y }, radius: at.r, seed: reactionSeed(tag, other.tag), level: other.tag.level ?? tag.level };
          if (found.kind === 'arcs') reaction.targets = Array.from(tokensOn({ x: at.x, y: at.y }, at.r) ?? []);
          try {
            const handle = spawn(reaction);
            if (handle) active.push(handle);
          } catch (err) { console.warn('Animater | skipped an element reaction', err); }
        }
        if (found.removes) remove(other);
      }
    },

    // On the PIXI ticker: never throws, and a reaction that fails is dropped.
    tick() {
      if (!active.length) return;
      let t;
      try { t = now(); } catch { return; }
      active = active.filter((handle) => {
        let alive;
        try { alive = handle.update(t); } catch { alive = false; }
        if (!alive) drop(handle);
        return alive;
      });
    },

    clear() {
      for (const handle of active) drop(handle);
      active = [];
    },

    count() {
      return active.length;
    },
  };
}
