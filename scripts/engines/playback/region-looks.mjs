// Region looks: a Tokenshade look set on a Foundry Region (Region configuration → Animater look) shows on every
// creature standing inside it — haunted ground pales them, a forge glows them warm, deep water soaks them — and fades
// in as they step in and out as they leave. Where regions overlap, the topmost (the one drawn last) wins.

export const REGION_LOOK_FLAG = 'tokenshade';

// The look a region gives, or null.
export const regionLook = (region, id) => {
  const name = region?.flags?.[id]?.[REGION_LOOK_FLAG];
  return typeof name === 'string' && name.trim() ? name.trim() : null;
};

// Which look each creature wants: Map tokenId → { region, preset }. `inside(region, token)` tests the creature's
// centre at its elevation; a token without an actor (a tile marker, a light) wants nothing.
export function regionLookWants({ tokens = [], regions = [], id, inside }) {
  const looking = [...regions].map((r) => ({ r, preset: regionLook(r, id) })).filter((x) => x.preset);
  const wants = new Map();
  if (!looking.length) return wants;
  for (const t of tokens) {
    if (!t?.actor) continue;
    for (let i = looking.length - 1; i >= 0; i--) {
      const { r, preset } = looking[i];
      let hit = false;
      try { hit = inside(r, t); } catch { /* a broken region never breaks the rest */ }
      if (hit) { wants.set(t.id, { region: r.id, preset }); break; }
    }
  }
  return wants;
}

// Keeps the shown looks in step with what is wanted: drops (fading) the looks no longer wanted or changed, and adds
// the new ones. `shown` is the live Map tokenId → { region, preset, remove }, changed in place.
export function syncRegionLooks(shown, wants, { apply }) {
  for (const [tid, look] of shown) {
    const want = wants.get(tid);
    if (want && want.region === look.region && want.preset === look.preset) continue;
    try { look.remove?.(); } catch { /* gone */ }
    shown.delete(tid);
  }
  for (const [tid, want] of wants) {
    if (shown.has(tid)) continue;
    const remove = apply(tid, want);
    if (remove) shown.set(tid, { ...want, remove });
  }
  return shown;
}

// Heat and cold around a creature (the "Heat and cold around creatures" setting): a fire creature's air shimmers, a
// cold one breathes a faint mist. From its traits (PF2e, SF2e), else its name for systems without them.
const HOT = /\b(?:fire|flame|magma|lava|salamander|efreeti?|ifrit|phoenix|hellhound|ember|inferno)\b/i;
const COLD = /\b(?:ice|frost|snow|winter|glacier|yeti|frozen|rime|boreal)\b/i;
export const NATURE_LOOKS = Object.freeze({ hot: 'Heat shimmer', cold: 'Cold mist' });
export function natureLook({ traits = [], name = '' } = {}) {
  const t = new Set(Array.from(traits ?? [], (x) => String(x).toLowerCase()));
  if (t.has('fire')) return NATURE_LOOKS.hot;
  if (t.has('cold') || t.has('ice')) return NATURE_LOOKS.cold;
  if (t.size && (t.has('water') || t.has('earth') || t.has('air'))) return null;
  if (HOT.test(name)) return NATURE_LOOKS.hot;
  if (COLD.test(name)) return NATURE_LOOKS.cold;
  return null;
}
